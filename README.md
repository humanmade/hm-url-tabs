# HM URL Tabs

A WordPress plugin that allows editors to use the core navigation block to create tab-based navigation with rewrite endpoints for conditional block visibility.

## Features

- **Tab Navigation Variations**: Extends the core `navigation-link` block with three variations:
  - **Home Tab**: Links to the current page without any endpoint
  - **Base Tab**: Links to just the endpoint without a value (e.g., `/tab/`)
  - **Tab**: Links with a rewrite endpoint and value (e.g., `/tab/settings/`)

- **Rewrite Endpoints**: Registers filterable rewrite endpoints (default: `tab`) with `EP_ALL` mask

- **URL Rewriting**: Automatically rewrites navigation link URLs to use the current page with the appropriate endpoint

- **Dynamic Tab Visibility Controls**: Adds a "Tab Visibility" panel to all blocks (except navigation-link) that automatically appears when the page contains tab navigation (no refresh needed), with options to:
  - Always show the block
  - Show only when no endpoint is active
  - Show only when the endpoint is in use but has no value (e.g., `/tab`)
  - Show only for a specific tab value (e.g., `/tab/settings`)

- **Active State**: Automatically adds `hm-url-tab-active` class to the current tab link

## Installation

1. Clone this repository into your `wp-content/plugins` directory
2. Run `npm install` to install dependencies
3. Run `npm run build` to build the assets
4. Activate the plugin through the WordPress admin

## Usage

### Creating Tab Navigation

1. Add a Navigation block to your page
2. Insert a navigation link and select one of the tab variations:
   - **Home Tab**: Links to the page without any endpoint
   - **Base Tab**: Links to just the endpoint (e.g., `/tab/`) - useful for "All" or default views
   - **Tab**: Links to a specific tab value (e.g., `/tab/settings/`)
3. For regular tabs:
   - Set the label (e.g., "Settings")
   - Enter the tab slug in the URL field (e.g., "settings")
4. The final URL will be automatically built from the current page URL with the endpoint and slug on the frontend

### Controlling Block Visibility

When your page contains tab navigation links:

1. Select any block on the page (except navigation links)
2. Open the "Tab Visibility" panel in the block sidebar
3. Choose the display condition:
   - **Always show**: Block is always visible
   - **Show when no endpoint is active**: Block is only visible on the base page (Home Tab)
   - **Show when endpoint has no value**: Block is visible when accessing `/tab/` (Base Tab)
   - **Show for specific tab**: Block is only visible for the selected tab value

### Example

Create a settings page with tabbed sections:

```
Page URL: /settings

Navigation:
- Home Tab → /settings
- All Settings Tab (Base Tab) → /settings/tab/
- General Tab → /settings/tab/general/
- Privacy Tab → /settings/tab/privacy/

Blocks:
- Welcome message (Visibility: Show when no endpoint is active)
- All settings list (Visibility: Show when endpoint has no value)
- General settings (Visibility: Show for specific tab → general)
- Privacy settings (Visibility: Show for specific tab → privacy)
```

## Customization

### Adding Custom Endpoints

You can register additional endpoints using the `hm_url_tabs_endpoints` filter:

```php
add_filter( 'hm_url_tabs_endpoints', function( $endpoints ) {
	$endpoints[] = [
		'name' => 'section',
		'mask' => EP_ALL,
	];
	return $endpoints;
} );
```

When multiple endpoints are registered, a selector will appear in the navigation link settings to choose which endpoint to use.

## Development

### Build Scripts

- `npm start`: Start development build with watch mode
- `npm run build`: Build production assets
- `npm run format`: Format code
- `npm run lint:js`: Lint JavaScript
- `npm run lint:js:fix`: Lint and fix JavaScript
- `npm run lint:css`: Lint CSS
- `npm run lint:css:fix`: Lint and fix CSS

### Local Development

Use WordPress Playground for local development:

```bash
npm run playground:start
```

This will start a WordPress instance at `http://localhost:9400` with the plugin activated.

### Testing

Run Playwright tests:

```bash
npm run test:e2e           # Run tests
npm run test:e2e:debug     # Run tests in debug mode
npm run test:e2e:watch     # Run tests in watch mode
```

## Filters

### `hm_url_tabs_endpoints`

Filters the registered tab endpoints.

**Parameters:**
- `$endpoints` (array): Array of endpoints with 'name' and 'mask' keys.

**Example:**
```php
add_filter( 'hm_url_tabs_endpoints', function( $endpoints ) {
	$endpoints[] = [
		'name' => 'custom',
		'mask' => EP_PAGES,
	];
	return $endpoints;
} );
```

## Technical Details

### Block Attributes

**Navigation Link (`core/navigation-link`):**
- `kind` (string): Set to "tab-home" for home tab, "tab-base" for base tab, or "tab" for regular tab
- `tabEndpoint` (string): The endpoint name to use (default: "tab")
- `url` (string): The URL slug for the tab (uses the standard navigation-link URL field, empty for Base Tab)

**All Other Blocks:**
- `hmUrlTabVisibility` (object):
  - `condition` (string): "always", "no-endpoint", "endpoint-empty", or "specific-tab"
  - `endpoint` (string): The endpoint name
  - `tabUrl` (string): The tab URL slug to match (for "specific-tab" condition)

### URL Structure

- Base page: `/settings`
- Home tab: `/settings`
- Base tab (endpoint without value): `/settings/tab/`
- Tab with value: `/settings/tab/general/`

**Note**: Tab URL slugs are automatically lowercased for consistency (e.g., "Settings" becomes `/tab/settings/`). All generated URLs include a trailing slash.

## License

GPL-2.0-or-later

## Author

Human Made Limited - https://humanmade.com
