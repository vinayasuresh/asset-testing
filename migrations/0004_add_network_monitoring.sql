-- Create Network Monitoring tables

-- Network Monitor Agents table
CREATE TABLE IF NOT EXISTS network_monitor_agents (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id TEXT NOT NULL UNIQUE,
    agent_name TEXT NOT NULL,
    os_type TEXT NOT NULL,
    version TEXT NOT NULL,
    api_key TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    last_heartbeat TIMESTAMP,
    agent_ip_address TEXT,
    network_range TEXT,
    tenant_id VARCHAR NOT NULL,
    installed_by VARCHAR NOT NULL,
    installed_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- WiFi Presence table
CREATE TABLE IF NOT EXISTS wifi_presence (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR NOT NULL,
    mac_address TEXT NOT NULL,
    ip_address TEXT,
    hostname TEXT,
    manufacturer TEXT,
    asset_id VARCHAR,
    asset_name TEXT,
    is_authorized BOOLEAN DEFAULT FALSE,
    first_seen TIMESTAMP NOT NULL DEFAULT NOW(),
    last_seen TIMESTAMP NOT NULL DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE,
    connection_duration INTEGER DEFAULT 0,
    device_type TEXT,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Unknown Device Alerts table
CREATE TABLE IF NOT EXISTS unknown_device_alerts (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR NOT NULL,
    mac_address TEXT NOT NULL,
    ip_address TEXT,
    hostname TEXT,
    manufacturer TEXT,
    detected_at TIMESTAMP NOT NULL DEFAULT NOW(),
    acknowledged_at TIMESTAMP,
    acknowledged_by VARCHAR,
    status TEXT NOT NULL DEFAULT 'pending',
    notes TEXT,
    device_info JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS wifi_presence_mac_idx ON wifi_presence(mac_address);
CREATE INDEX IF NOT EXISTS wifi_presence_tenant_active_idx ON wifi_presence(tenant_id, is_active);
CREATE INDEX IF NOT EXISTS unknown_device_alerts_tenant_status_idx ON unknown_device_alerts(tenant_id, status);
CREATE INDEX IF NOT EXISTS network_monitor_agents_tenant_idx ON network_monitor_agents(tenant_id);
