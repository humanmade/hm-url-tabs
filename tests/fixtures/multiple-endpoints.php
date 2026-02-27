<?php
/**
 * HM URL Tabs - Multiple Endpoints Test Fixture
 *
 * Adds an 'overview' endpoint with EP_CATEGORIES mask for testing
 * multiple endpoint functionality on category archive templates.
 *
 * Loaded as a mu-plugin in the playground test environment via blueprint.json.
 */

namespace HM\URLTabs\TestFixtures;

add_filter( 'hm_url_tabs_endpoints', function ( array $endpoints ) : array {
	$endpoints[] = [
		'name' => 'overview',
		'mask' => \EP_CATEGORIES,
	];
	return $endpoints;
} );
