# HM URL Tabs - Development Notes

This plugin was created using Claude Code following the Human Made plugin structure.

## Architecture

### PHP (hm-url-tabs.php)

The main plugin file handles:

1. **Rewrite Endpoint Registration**: Registers filterable endpoints (default: `tab`) using `add_rewrite_endpoint()` with `EP_ALL` mask

2. **Block Variations**: Filters `get_block_type_variations` to add three variations to `core/navigation-link`:
   - `tab-home`: Home tab with `kind='tab-home'` that links to current page without endpoint
   - `tab-base`: Base tab with `kind='tab-base'` that links to just the endpoint (e.g., `/tab/`)
   - `tab`: Regular tab with `kind='tab'` and endpoint + value (e.g., `/tab/general/`)
   - Each variation has a unique `kind` attribute value so the `isActive` check can properly distinguish between them
   - All variations use `scope: ['inserter']` (not transform)

3. **URL Rewriting**: Filters `render_block` to:
   - Rewrite navigation link URLs using `WP_HTML_Tag_Processor`
   - Add active state class to current tab
   - Hide blocks based on tab visibility settings

4. **Endpoint Value Detection**: Helper function `get_current_endpoint_value()` to check the current endpoint value on the frontend for visibility logic

### JavaScript (src/editor.js)

The editor script handles:

1. **Block Attributes**: Adds custom attributes via `blocks.registerBlockType` filter:
   - `tabEndpoint` for navigation-link (uses standard `url` attribute for the slug)
   - `hmUrlTabVisibility` (with `condition`, `endpoint`, `tabUrl`) for all other blocks

2. **Tab Visibility Controls**: Adds panel to all blocks with:
   - Condition selector (always, no-endpoint, endpoint-empty, specific-tab)
   - Endpoint selector (when multiple endpoints exist)
   - Tab selector (populated from page's tab navigation)

4. **Dynamic Tab Detection**:
   - Uses `useSelect` with `getBlocksByName('core/navigation-link')` to find all navigation links recursively
   - Filters client IDs to find only tab variations (`kind === 'tab'`, `kind === 'tab-home'`, or `kind === 'tab-base'`)
   - Maps block data directly in the selector without needing `useEffect` or helper functions
   - Tab Visibility panel automatically appears/disappears as tabs are added/removed
   - Base Tab and Home Tab are filtered out of the "specific tab" selector (they have their own visibility conditions)
   - No page refresh needed - everything updates dynamically in the editor
   - URLs are lowercased for consistency

### URL Structure

- Base page (no endpoint): `/settings`
- Home tab: `/settings` (same as base page)
- Base tab (endpoint only): `/settings/tab/`
- Tab with value: `/settings/tab/general/`

All generated tab URLs include a trailing slash for consistency.

## Architecture Decisions

### Dynamic Tab Detection

All tab detection happens in JavaScript, not server-side:
- **Why**: Tab detection must be dynamic so the Tab Visibility panel appears/disappears as editors add/remove tab navigation items
- **How**: Uses `getBlocksByName('core/navigation-link')` which returns client IDs recursively, then filters and maps to tab data
- **Benefits**:
  - More efficient than traversing all blocks manually
  - No `useEffect` needed - everything happens directly in `useSelect`
  - Automatic re-rendering when navigation links change
- **Result**: Real-time updates without page refresh

The PHP side only handles:
- Registering rewrite endpoints
- Providing block variations
- Rendering blocks with correct URLs (lowercased) and visibility on the frontend

## Key Features

### Standard URL Field

Tab variations use the standard navigation-link `url` field:
- Users enter the tab slug directly (e.g., "settings")
- Empty value allowed for endpoint-only tabs (e.g., just `/tab`)
- Home tab ignores the URL field

### Active State

The plugin automatically adds `hm-url-tab-active` class to navigation links when:
- Home tab is active and no endpoint is present
- Regular tab's value matches current endpoint value

### Conditional Visibility

Blocks can be shown/hidden based on:
- **always**: Always visible (default)
- **no-endpoint**: Only when endpoint is not in use
- **endpoint-empty**: Only when endpoint is in use but has no value (e.g., `/tab`)
- **specific-tab**: Only when specific tab value matches

## Development Workflow

1. Edit source files in `src/`
2. Run `npm start` for development build with watch
3. Run `npm run build` for production build
4. Use `npm run playground:start` for local testing

## Testing

Playwright tests in `tests/` directory verify:
- Tab variations are registered
- Tab visibility controls appear when needed
- URLs are generated correctly

## Filters

### `hm_url_tabs_endpoints`

Allows customization of registered endpoints:

```php
add_filter( 'hm_url_tabs_endpoints', function( $endpoints ) {
	$endpoints[] = [
		'name' => 'custom',
		'mask' => EP_PAGES,
	];
	return $endpoints;
} );
```

## Known Issues

- Requires `@babel/runtime` to be explicitly installed as a dependency (not automatically included by `@wordpress/scripts`)

## Future Enhancements

Potential improvements:
- Support for nested tabs
- Custom tab change animations
- AJAX content loading for tabs
- Query string parameter support as alternative to rewrite endpoints
- Tab state persistence in session storage
