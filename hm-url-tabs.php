<?php
/**
 * Plugin Name: HM URL Tabs
 * Description: Allows editors to use the core navigation block to create tab-based navigation with rewrite endpoints for conditional block visibility.
 * Version: __VERSION__
 * Author: Human Made Limited
 * Author URI: https://humanmade.com
 * License: GPL-2.0+
 * License URI: http://www.gnu.org/licenses/gpl-2.0.txt
 * Text Domain: hm-url-tabs
 */

namespace HM\URLTabs;

use WP_HTML_Tag_Processor;

/**
 * Get the registered endpoints.
 *
 * @return array Array of endpoint configurations.
 */
function get_endpoints() : array {
	/**
	 * Filter the registered tab endpoints.
	 *
	 * @param array $endpoints Array of endpoints with 'name' and 'mask' keys.
	 */
	return apply_filters( 'hm_url_tabs_endpoints', [
		[
			'name' => 'tab',
			'mask' => \EP_ALL,
		],
	] );
}

/**
 * Register rewrite endpoints.
 */
add_action( 'init', function() : void {
	$endpoints = get_endpoints();
	foreach ( $endpoints as $endpoint ) {
		add_rewrite_endpoint( $endpoint['name'], $endpoint['mask'] ?? \EP_ALL );
	}
} );

/**
 * Enqueue block editor assets.
 */
add_action( 'enqueue_block_editor_assets', function() : void {
	$asset = require __DIR__ . '/build/editor.asset.php';
	wp_enqueue_script(
		'hm-url-tabs-editor',
		plugins_url( 'build/editor.js', __FILE__ ),
		$asset['dependencies'],
		$asset['version']
	);
	wp_enqueue_style(
		'hm-url-tabs-editor',
		plugins_url( 'build/editor.css', __FILE__ ),
		[],
		$asset['version']
	);

	// Pass endpoints and current URL to the editor.
	wp_localize_script(
		'hm-url-tabs-editor',
		'hmUrlTabsData',
		[
			'endpoints' => get_endpoints(),
			'currentUrl' => get_permalink(),
		]
	);
} );

/**
 * Enqueue frontend assets.
 */
add_action( 'wp_enqueue_scripts', function() : void {
	$asset = require __DIR__ . '/build/frontend.asset.php';
	wp_enqueue_script(
		'hm-url-tabs-frontend',
		plugins_url( 'build/frontend.js', __FILE__ ),
		$asset['dependencies'],
		$asset['version'],
		true
	);
	wp_enqueue_style(
		'hm-url-tabs-frontend',
		plugins_url( 'build/frontend.css', __FILE__ ),
		[],
		$asset['version']
	);
} );

/**
 * Get the current endpoint value.
 *
 * First checks the query var (set by WordPress rewrite rules).
 * Falls back to parsing the request URI, since some rewrite
 * configurations (e.g. overview on sector archives) don't
 * reliably populate the query var.
 *
 * @param string $endpoint_name The endpoint name to check.
 * @return string|null The endpoint value, empty string if endpoint
 *                     is present with no value, or null if not set.
 */
function get_current_endpoint_value( string $endpoint_name = 'tab' ) : ?string {
	// Parse the request URI for the endpoint segment. This is more
	// reliable than get_query_var() because some rewrite configurations
	// (e.g. overview on sector archives) don't reliably populate the
	// query var, or WordPress may set it to '' even when the endpoint
	// is not present in the URL.
	$request_path = strtok( $_SERVER['REQUEST_URI'] ?? '', '?' );
	$ep_segment   = '/' . $endpoint_name . '/';
	$pos          = strpos( $request_path, $ep_segment );

	if ( $pos !== false ) {
		// Endpoint found in URL — extract anything after it.
		$after = substr( $request_path, $pos + strlen( $ep_segment ) );
		$after = trim( $after, '/' );

		return $after !== '' ? $after : '';
	}

	// Endpoint not found in URL — check query var as fallback
	// (e.g. when endpoint is passed as ?endpoint=value).
	$value = get_query_var( $endpoint_name, null );
	if ( $value !== null && $value !== '' ) {
		return $value;
	}

	return null;
}

/**
 * Filter navigation-item block variations.
 *
 * @param array  $variations The existing variations.
 * @param object $block_type The block type object.
 * @return array Modified variations.
 */
add_filter( 'get_block_type_variations', function( array $variations, object $block_type ) : array {
	if ( $block_type->name !== 'core/navigation-link' ) {
		return $variations;
	}

	// Add "Home Tab" variation.
	$variations[] = [
		'name' => 'tab-home',
		'title' => __( 'Home Tab', 'hm-url-tabs' ),
		'description' => __( 'A tab link to the current page without any endpoint value.', 'hm-url-tabs' ),
		'attributes' => [
			'kind' => 'tab-home',
			'tabEndpoint' => '',
			'url' => '',
		],
		'isActive' => [ 'kind' ],
		'scope' => [ 'inserter' ],
	];

	// Add "Base Tab" variation.
	$variations[] = [
		'name' => 'tab-base',
		'title' => __( 'Base Tab', 'hm-url-tabs' ),
		'description' => __( 'A tab link to the endpoint without a value (e.g., /tab/).', 'hm-url-tabs' ),
		'attributes' => [
			'kind' => 'tab-base',
			'tabEndpoint' => 'tab',
			'url' => '',
		],
		'isActive' => [ 'kind' ],
		'scope' => [ 'inserter' ],
	];

	// Add "Tab" variation.
	$variations[] = [
		'name' => 'tab',
		'title' => __( 'Tab', 'hm-url-tabs' ),
		'description' => __( 'A tab link with a rewrite endpoint for conditional content display.', 'hm-url-tabs' ),
		'attributes' => [
			'kind' => 'tab',
			'tabEndpoint' => 'tab',
			'url' => '',
		],
		'isActive' => [ 'kind' ],
		'scope' => [ 'inserter' ],
	];

	return $variations;
}, 10, 2 );

/**
 * Filter the render output of navigation-link blocks to rewrite URLs.
 *
 * @param string $block_content The block content.
 * @param array  $block The parsed block.
 * @return string The modified block content.
 */
add_filter( 'render_block', function( string $block_content, array $block ) : string {
	// Handle tab navigation links.
	if ( $block['blockName'] === 'core/navigation-link' && ! empty( $block['attrs']['kind'] ) && in_array( $block['attrs']['kind'], [ 'tab', 'tab-home', 'tab-base' ], true ) ) {
		$kind = $block['attrs']['kind'];
		$endpoint = $block['attrs']['tabEndpoint'] ?? 'tab';
		$endpoint = ! empty( $endpoint ) ? $endpoint : 'tab';
		$tab_value = sanitize_title_with_dashes( $block['attrs']['url'] ?? '' );

		// Get the current page base URL by stripping any registered endpoint
		// segment. We check all registered endpoints (not just this block's)
		// so that tab-home correctly finds the base URL even when its own
		// tabEndpoint attribute differs from the active endpoint.
		$current_url = strtok( $_SERVER['REQUEST_URI'], '?' );
		$all_endpoints = get_endpoints();
		foreach ( $all_endpoints as $ep ) {
			$ep_segment = '/' . $ep['name'] . '/';
			$pos = strpos( $current_url, $ep_segment );
			if ( $pos !== false ) {
				$current_url = trailingslashit( substr( $current_url, 0, $pos ) );
				break;
			}
		}

		// Build the tab URL.
		if ( $kind === 'tab-home' ) {
			// Home tab is just the current URL.
			$tab_url = $current_url;
		} elseif ( $kind === 'tab-base' ) {
			// Base tab is just the endpoint without a value (e.g., /tab/).
			$tab_url = trailingslashit( $current_url ) . trailingslashit( $endpoint );
		} else {
			// Regular tab with endpoint and value (e.g., /tab/tab-name/).
			$tab_url = trailingslashit( $current_url ) . trailingslashit( $endpoint ) . trailingslashit( $tab_value );
		}

		// Use WP_HTML_Tag_Processor to update the href.
		$processor = new WP_HTML_Tag_Processor( $block_content );
		if ( $processor->next_tag( 'li' ) ) {
			// Determine if this tab is active by comparing
			// the generated tab URL with the current request URI path.
			$request_path = strtok( $_SERVER['REQUEST_URI'], '?' );
			$is_active = untrailingslashit( $tab_url ) === untrailingslashit( $request_path );

			if ( $is_active ) {
				$processor->add_class( 'current-menu-item' );
			}

			$processor->next_tag( 'a' );
			$processor->add_class( 'hm-url-tab-link' );
			if ( $is_active ) {
				$processor->add_class( 'hm-url-tab-active' );
			}
			$processor->set_attribute( 'href', $tab_url );
		}

		return (string) $processor;
	}

	// Handle tab visibility for all other blocks.
	if ( ! empty( $block['attrs']['hmUrlTabVisibility'] ) ) {
		$visibility = $block['attrs']['hmUrlTabVisibility'];
		$condition = $visibility['condition'] ?? 'always';
		$endpoint = $visibility['endpoint'] ?? 'tab';
		$endpoint = ! empty( $endpoint ) ? $endpoint : 'tab';
		$tab_value = sanitize_title_with_dashes( $visibility['tabUrl'] ?? '' );

		$current_endpoint_value = get_current_endpoint_value( $endpoint );

		$should_hide = false;

		switch ( $condition ) {
			case 'always':
				// Always show.
				break;

			case 'endpoint-empty':
				// Show only when endpoint is in use but with no value (e.g., /tab).
				if ( $current_endpoint_value !== '' ) {
					$should_hide = true;
				}
				break;

			case 'no-endpoint':
				// Show only when NO registered endpoint is active in the URL.
				// Check all registered endpoints, not just the one stored in
				// the block attribute, since it may be stale or irrelevant.
				$all_endpoints = get_endpoints();
				foreach ( $all_endpoints as $ep ) {
					if ( get_current_endpoint_value( $ep['name'] ) !== null ) {
						$should_hide = true;
						break;
					}
				}
				break;

			case 'specific-tab':
				// Show only when specific tab value matches.
				if ( sanitize_title_with_dashes( $current_endpoint_value ) !== $tab_value ) {
					$should_hide = true;
				}
				break;
		}

		if ( $should_hide ) {
			return '';
		}

		// Add data attribute for frontend transitions if visibility is not 'always'.
		if ( $condition !== 'always' ) {
			$processor = new WP_HTML_Tag_Processor( $block_content );
			if ( $processor->next_tag() ) {
				$processor->set_attribute( 'data-hm-tab-visibility', $endpoint );
			}
			$block_content = (string) $processor;
		}
	}

	return $block_content;
}, 10, 2 );
