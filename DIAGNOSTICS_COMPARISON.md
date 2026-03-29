# Diagnostics Page vs System Status Panel Comparison

## Overview
This document compares the System Status panel (located on the main page) with the Diagnostics page (SystemView) in the Mission Control application. Both components display system health information but serve different purposes and present data differently.

## Component Analysis

### System Status Panel (`ShipStatus.tsx`)
**Location:** Main page sidebar/dashboard
**Purpose:** Compact, at-a-glance system health overview

**Data Sources Used:**
- gatewayHealth (connection status)
- gatewayReady (uptime information)
- memory (file/indexing stats)
- channels (active communication channels)
- sessions (active AI sessions)
- security (threat summary)
- Hardcoded version info

**Information Displayed:**
1. **Gateway Status** - Online/Offline indicator with status dot
2. **Uptime** - Formatted uptime when gateway is ready
3. **Sessions** - Count of active sessions + total token usage
4. **Memory** - Files/chunks count, FTS/Vector availability, reindex warning
5. **Channels** - Count of active channels + list of channel names
6. **Security** - Alert/Nominal status with critical/warn/info counts
7. **Version** - Hardcoded version number [2026.3.13]

**Presentation Format:**
- Vertical list of status rows with LCARS styling
- Each section has a numbered header (47-31 through 47-39)
- Status indicators use colored dots (green/red)
- Compact layout optimized for sidebar/dashboard placement
- Conditional rendering based on data availability

### Diagnostics Page (`SystemView.tsx`)
**Location:** Dedicated diagnostics view
**Purpose:** Detailed system analysis and troubleshooting view

**Data Sources Used:**
- gatewayHealth (connection status)
- gatewayReady (uptime and failure information)
- memory (detailed memory/provider stats)
- channels (individual channel status)
- sessions (detailed session information)
- security (detailed threat breakdown)
- Hardcoded version/build info

**Information Displayed:**
1. **Sessions Panel** - Detailed list of each session with:
   - Session identifier (key)
   - Model being used
   - Resource usage percentage
   - Activity status (active/idle based on age)
2. **Gateway Panel** - Connection details including:
   - Status (Running/Offline)
   - Port number (18789)
   - Uptime
   - Connection mode and binding info
   - List of failing services (if any)
3. **Memory Panel** - Detailed memory/storage information:
   - File and chunk counts
   - Provider and model information
   - FTS and Vector availability with dimensions
   - Cache statistics and dirty state
4. **Channels Panel** - Individual channel status:
   - Each channel listed separately with ACTIVE status
5. **Security Panel** - Detailed threat breakdown:
   - Critical threats count (with error status if >0)
   - Warnings count
   - Info messages count
6. **Version Panel** - Build information:
   - Build number (2026.3.13)
   - LCARS interface version
   - Description text

**Presentation Format:**
- 2-column grid layout
- Each section in its own LCARS panel with colored headers
- Detailed status rows within each panel
- More verbose labels and values
- Visual indicators for failing services and cache state
- Responsive design that adapts to screen size

## Comparison Analysis

### Information in Diagnostics NOT in System Status:

1. **Detailed Session Information:**
   - Individual session keys and models
   - Per-session resource usage percentages
   - Session activity status based on age (<5min = active)

2. **Enhanced Gateway Information:**
   - Specific port number (18789)
   - Connection mode and binding details (local/loopback)
   - List of failing services when present

3. **Detailed Memory Information:**
   - Specific memory provider and model
   - Vector dimensions
   - Cache entry count
   - Explicit dirty state indicator

4. **Enhanced Channels Information:**
   - Individual channel status rows (vs just count)
   - Visual separation of each channel

5. **Detailed Security Breakdown:**
   - Separate rows for Critical/Warnings/Info counts
   - Color-coded values matching threat levels

6. **Enhanced Version Information:**
   - Separate build number display
   - LCARS interface version and description
   - Styled with monospace font for build number

### Information in System Status NOT in Diagnostics:

1. **Token Usage Aggregation:**
   - Total token count across all sessions (System Status shows aggregated tokens; Diagnostics shows per-session usage but not total)

2. **Uptime Prominence:**
   - More prominent uptime display in System Status (though Diagnostics also shows it)

### Overlap/Duplication:

Both components display:
- Gateway connection status (online/offline)
- Session count
- Memory file/chunk counts
- Channel count
- Security threat counts (though formatted differently)
- Version/build information

### Presentation Inconsistencies:

1. **Status Text Variations:**
   - Gateway: System Status shows "[ONLINE]/[OFFLINE]" vs Diagnostics "[RUNNING]/[OFFLINE]"
   - Sessions: System Status shows "[X ACTIVE]" vs Diagnostics shows individual session rows

2. **Uptime Formatting:**
   - Both use `formatUptime()` helper, but System Status labels it "UPTIME:" while Diagnostics includes it in a data line with port info

3. **Security Presentation:**
   - System Status: Single row with alert/nominal status + color-coded counts
   - Diagnostics: Three separate rows for critical/warnings/info with colored values

4. **Memory Details:**
   - System Status: Files/chunks on one line, FTS/Vector on another, dirty warning separate
   - Diagnostics: More structured presentation with provider/model/cache details

## Recommendations for Consolidation or Improvements:

1. **Create Shared Components:**
   - Extract common status row patterns into reusable components
   - Create shared gateway status, memory stats, and security summary components

2. **Standardize Status Indicators:**
   - Use consistent text labels for status states (e.g., always "[ONLINE]" or always "[RUNNING]")
   - Standardize how session counts are displayed

3. **Consider Information Hierarchy:**
   - System Status could benefit from showing failing services (from Diagnostics)
   - Diagnostics could show aggregated token usage alongside per-session stats

4. **Improve Layout Consistency:**
   - Consider making System Status expandable to show more detail on click
   - Or make Diagnostics accessible via a "Details" link from System Status

5. **Version Information:**
   - Move hardcoded version to a shared constant or fetch from gateway
   - Ensure both components display version information consistently

6. **Memory Panel Enhancement:**
   - Consider showing memory usage percentage if available from gateway
   - Add more prominent visual indicator for dirty state requiring reindex

7. **Security Visualization:**
   - Consider adding a visual threat level indicator (like a gauge) in addition to counts
   - Make the security status more prominent when critical issues exist

## Conclusion:

The System Status panel serves as an effective at-a-glance dashboard ideal for the main interface, while the Diagnostics page provides the detailed troubleshooting view needed for system administration. Rather than full consolidation, maintaining both views with improved consistency and shared components would provide the best user experience. The System Status could be enhanced with select diagnostic details (like failing services) while keeping its compact form factor.