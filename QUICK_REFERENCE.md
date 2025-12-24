# Quick Reference: Dynamic Multi-Tenancy

## How Tenants Are Resolved (Priority Order)

```
1. JWT Token (req.user.tenantId)           ← Primary for authenticated users
2. Enrollment Token (agent enrollment)     ← For device enrollment
3. Subdomain (nike.assetnext.com)         ← Optional enhancement
4. Path Parameter (/org/nike/dashboard)    ← Optional enhancement
```

## Environment Variables Status

### ✅ Keep These (Global Settings)
```bash
DATABASE_URL=postgresql://...
JWT_SECRET=your-secret
PORT=5000
OA_SYNC_ENABLED=true   # Global enable/disable
```

### ⚠️ These Are Now Optional (Deprecated)
```bash
# Only needed for backward compatibility during migration
ENROLL_DEFAULT_TENANT_ID=<fallback-tenant>
OA_TENANT_ID=<legacy-single-tenant>
DEFAULT_TENANT_ID=<legacy-fallback>
```

### ❌ Remove These After Migration
Once enrollment tokens are deployed, these can be removed entirely.

## Code Examples

### Backend: Getting Tenant ID

```typescript
// ✅ CORRECT - Use req.user.tenantId from JWT
app.get("/api/assets", authenticateToken, async (req, res) => {
  const tenantId = req.user!.tenantId;  // From JWT
  const assets = await storage.getAllAssets(tenantId);
  res.json(assets);
});

// ❌ WRONG - Don't hardcode
app.get("/api/assets", async (req, res) => {
  const tenantId = process.env.TENANT_ID;  // NO!
  // ...
});
```

### Frontend: Sending Requests

```typescript
// ✅ CORRECT - JWT is sent automatically
const { data } = useQuery({
  queryKey: ["/api/assets"],
  // Token with tenantId is in Authorization header
});

// ❌ WRONG - Don't send tenantId manually
const response = await fetch("/api/assets", {
  body: JSON.stringify({ tenantId: "..." })  // NO!
});
```

### Database Queries

```typescript
// ✅ CORRECT - Always filter by tenantId
async getAllAssets(tenantId: string) {
  return await db.select()
    .from(assets)
    .where(eq(assets.tenantId, tenantId));
}

// ❌ WRONG - Missing tenant filter
async getAllAssets() {
  return await db.select()
    .from(assets);  // Returns ALL tenants' data!
}
```

## Common Patterns

### Pattern 1: Create Resource

```typescript
app.post("/api/assets", authenticateToken, async (req, res) => {
  const asset = await storage.createAsset({
    ...req.body,
    tenantId: req.user!.tenantId,  // Inject from JWT
  });
  res.json(asset);
});
```

### Pattern 2: Get Resource

```typescript
app.get("/api/assets/:id", authenticateToken, async (req, res) => {
  const asset = await storage.getAsset(
    req.params.id,
    req.user!.tenantId  // Always pass tenant
  );
  
  if (!asset) {
    return res.status(404).json({ message: "Not found" });
  }
  
  res.json(asset);
});
```

### Pattern 3: List Resources

```typescript
app.get("/api/assets", authenticateToken, async (req, res) => {
  const assets = await storage.getAllAssets(
    req.user!.tenantId,  // Tenant from JWT
    {
      type: req.query.type,
      status: req.query.status,
    }
  );
  res.json(assets);
});
```

## Security Checklist

- [ ] Every API endpoint has `authenticateToken` middleware
- [ ] Every database query filters by `tenantId`
- [ ] User cannot provide their own `tenantId` in request body
- [ ] Resource access checks tenant ownership
- [ ] JWT contains `tenantId` that cannot be tampered with
- [ ] Database has unique indexes on `(tenant_id, resource_id)`

## Testing Multi-Tenancy

### Test Script

```bash
#!/bin/bash

# Create two tenants
NIKE_TOKEN=$(curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"nike@test.com","password":"test123","firstName":"Nike","lastName":"Admin","tenantName":"Nike"}' \
  | jq -r '.token')

ADIDAS_TOKEN=$(curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"adidas@test.com","password":"test123","firstName":"Adidas","lastName":"Admin","tenantName":"Adidas"}' \
  | jq -r '.token')

# Nike creates asset
curl -X POST http://localhost:5000/api/assets \
  -H "Authorization: Bearer $NIKE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Nike Laptop","type":"Hardware","status":"in-stock"}'

# Adidas creates asset
curl -X POST http://localhost:5000/api/assets \
  -H "Authorization: Bearer $ADIDAS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Adidas Laptop","type":"Hardware","status":"in-stock"}'

# Verify Nike sees only Nike's asset
echo "Nike's assets:"
curl -X GET http://localhost:5000/api/assets \
  -H "Authorization: Bearer $NIKE_TOKEN" \
  | jq '.[] | .name'

# Verify Adidas sees only Adidas's asset
echo "Adidas's assets:"
curl -X GET http://localhost:5000/api/assets \
  -H "Authorization: Bearer $ADIDAS_TOKEN" \
  | jq '.[] | .name'
```

### Expected Output

```
Nike's assets:
"Nike Laptop"

Adidas's assets:
"Adidas Laptop"
```

✅ Perfect isolation!

## Troubleshooting

### Issue: "User sees wrong tenant's data"

**Check:**
1. Is `authenticateToken` middleware applied?
2. Is `req.user.tenantId` being used?
3. Is JWT valid and not expired?
4. Is database query filtering by `tenantId`?

### Issue: "Agent enrollment creates assets in wrong tenant"

**Solution:**
- Use enrollment tokens (see MULTI_TENANCY_IMPLEMENTATION.md)
- Don't rely on `ENROLL_DEFAULT_TENANT_ID`

### Issue: "OpenAudit sync only works for one tenant"

**Solution:**
- Implement per-tenant sync (see MULTI_TENANCY_IMPLEMENTATION.md)
- Store OA credentials in `tenants` table
- Run scheduler for all enabled tenants

## Resources

- Full Implementation Guide: `MULTI_TENANCY_IMPLEMENTATION.md`
- Status Report: `MULTI_TENANCY_STATUS.md`
- Middleware Code: `server/middleware/tenantContext.ts`
- Schema Updates: `shared/schema.ts`

## Summary

```
┌─────────────────┐
│  User Logs In   │
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│ JWT Generated   │  ← Contains tenantId
│ with tenantId   │
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│ Every Request   │  ← JWT in Authorization header
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│ Middleware      │  ← Extracts req.user.tenantId
│ Extracts JWT    │
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│ Route Handler   │  ← Uses req.user.tenantId
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│ Database Query  │  ← WHERE tenant_id = req.user.tenantId
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│ Returns Data    │  ← Only for that tenant
│ for One Tenant  │
└─────────────────┘
```

**No .env changes needed. It just works!** 🎉
