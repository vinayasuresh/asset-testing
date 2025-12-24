# Geographic Data Files

This directory contains geographic data files used for location dropdowns in the asset management system and map visualization.

## Files

- `countries.json` - List of all countries (423KB)
- `states.json` - List of all states/provinces with coordinates (2.1MB)
- `cities.json` - List of all cities (3.9MB)
- `world_complete.json` - Complete hierarchical data with GPS coordinates (44MB) - **Required for map**

## Production Deployment

These files are tracked in git and should be deployed with the application. However, due to their large size (total ~6.4MB), some deployment platforms may have issues:

### If Location Dropdowns Show "No Data"

1. **Check if files exist on server:**
   ```bash
   ls -lh server/data/*.json
   ```

2. **If files are missing or empty, they can be downloaded from:**
   - https://github.com/dr5hn/countries-states-cities-database

### Alternative: Environment Variable Configuration

If your deployment platform has file size limits, you can:

1. Upload the JSON files to a cloud storage service (S3, Cloud Storage, etc.)
2. Set environment variable `GEOGRAPHIC_DATA_URL` to point to the storage location
3. The server will download the data on startup if local files don't exist

## Data Source

Geographic data is sourced from: https://github.com/dr5hn/countries-states-cities-database

Licensed under: Open Database License (ODbL)
