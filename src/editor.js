import { __ } from '@wordpress/i18n';
import { InspectorControls } from '@wordpress/block-editor';
import { PanelBody, SelectControl } from '@wordpress/components';
import { addFilter } from '@wordpress/hooks';
import { createHigherOrderComponent } from '@wordpress/compose';
import { useSelect } from '@wordpress/data';

import './editor.css';

/**
 * Add custom attributes to the navigation-link block for tab functionality.
 *
 * @param {Object} settings The block settings.
 * @param {string} name     The block name.
 * @return {Object} Modified settings.
 */
function addNavigationLinkAttributes( settings, name ) {
	if ( name !== 'core/navigation-link' ) {
		return settings;
	}

	return {
		...settings,
		attributes: {
			...settings.attributes,
			tabEndpoint: {
				type: 'string',
				default: 'tab',
			},
		},
	};
}

addFilter(
	'blocks.registerBlockType',
	'hm-url-tabs/add-navigation-link-attributes',
	addNavigationLinkAttributes
);

/**
 * Add tab visibility attributes to all blocks.
 *
 * @param {Object} settings The block settings.
 * @return {Object} Modified settings.
 */
function addTabVisibilityAttributes( settings ) {
	// Don't add to navigation-link as it has its own controls.
	if ( settings.name === 'core/navigation-link' ) {
		return settings;
	}

	return {
		...settings,
		attributes: {
			...settings.attributes,
			hmUrlTabVisibility: {
				type: 'object',
				default: {
					condition: 'always',
					endpoint: 'tab',
					tabUrl: '',
				},
			},
		},
	};
}

addFilter(
	'blocks.registerBlockType',
	'hm-url-tabs/add-tab-visibility-attributes',
	addTabVisibilityAttributes
);

/**
 * Add Tab Visibility controls to all blocks (except navigation-link).
 */
const withTabVisibilityControls = createHigherOrderComponent( ( BlockEdit ) => {
	return ( props ) => {
		const { attributes, setAttributes, name, clientId } = props;

		// Don't add to navigation-link.
		if ( ! attributes || name === 'core/navigation-link' ) {
			return <BlockEdit { ...props } />;
		}

		const { hmUrlTabVisibility = {} } = attributes;
		const {
			condition = 'always',
			endpoint = 'tab',
			tabUrl = '',
		} = hmUrlTabVisibility;

		// Get tab navigation links from the page using getBlocksByName.
		const { tabs, hasParentWithVisibility } = useSelect(
			( select ) => {
				const {
					getBlocksByName,
					getBlock,
					getBlockParents,
					hasSelectedInnerBlock: checkSelectedInnerBlock,
				} = select( 'core/block-editor' );

				// Get all navigation-link block client IDs recursively.
				const navLinkClientIds = getBlocksByName(
					'core/navigation-link'
				);

				// Filter to only tab variations and extract their data.
				const tabData = navLinkClientIds
					.map( ( id ) => getBlock( id ) )
					.filter(
						( block ) =>
							block?.attributes?.kind === 'tab' ||
							block?.attributes?.kind === 'tab-home' ||
							block?.attributes?.kind === 'tab-base'
					)
					.map( ( block ) => ( {
						label: block.attributes.label || '',
						url: block.attributes.url || '',
						endpoint: block.attributes.tabEndpoint || 'tab',
						isHomeTab: block.attributes.kind === 'tab-home',
						isBaseTab: block.attributes.kind === 'tab-base',
					} ) );

				// Check if any parent block has tab visibility settings.
				const parentIds = getBlockParents( clientId );
				const parentHasVisibility = parentIds.some( ( parentId ) => {
					const parentBlock = getBlock( parentId );
					return (
						parentBlock?.attributes?.hmUrlTabVisibility
							?.condition &&
						parentBlock.attributes.hmUrlTabVisibility.condition !==
							'always'
					);
				} );

				return {
					tabs: tabData,
					hasParentWithVisibility: parentHasVisibility,
					hasSelectedInnerBlock: checkSelectedInnerBlock(
						clientId,
						true
					),
				};
			},
			[ clientId ]
		);

		// Only show tab visibility if the page has tab navigation.
		if ( tabs.length === 0 ) {
			return <BlockEdit { ...props } />;
		}

		// Hide controls if parent has visibility settings.
		if ( hasParentWithVisibility ) {
			return <BlockEdit { ...props } />;
		}

		const endpoints = Array.from(
			new Set( tabs.map( ( tab ) => tab.endpoint ) )
		);
		const showEndpointSelector = endpoints.length > 1;

		// Get tabs for the selected endpoint.
		const tabsForEndpoint = tabs.filter(
			( tab ) => tab.endpoint === endpoint
		);

		return (
			<>
				<BlockEdit { ...props } />
				<InspectorControls>
					<PanelBody
						title={ __( 'Tab Visibility', 'hm-url-tabs' ) }
						initialOpen={ false }
					>
						<SelectControl
							label={ __( 'Display Condition', 'hm-url-tabs' ) }
							value={ condition }
							options={ [
								{
									label: __( 'Always show', 'hm-url-tabs' ),
									value: 'always',
								},
								{
									label: __(
										'Show when no endpoint is active',
										'hm-url-tabs'
									),
									value: 'no-endpoint',
								},
								{
									label: __(
										'Show when endpoint has no value',
										'hm-url-tabs'
									),
									value: 'endpoint-empty',
								},
								{
									label: __(
										'Show for specific tab',
										'hm-url-tabs'
									),
									value: 'specific-tab',
								},
							] }
							onChange={ ( value ) =>
								setAttributes( {
									hmUrlTabVisibility: {
										...hmUrlTabVisibility,
										condition: value,
									},
								} )
							}
						/>

						{ showEndpointSelector &&
							condition === 'specific-tab' && (
								<SelectControl
									label={ __( 'Endpoint', 'hm-url-tabs' ) }
									value={ endpoint }
									options={ endpoints.map( ( ep ) => ( {
										label: ep,
										value: ep,
									} ) ) }
									onChange={ ( value ) =>
										setAttributes( {
											hmUrlTabVisibility: {
												...hmUrlTabVisibility,
												endpoint: value,
											},
										} )
									}
								/>
							) }

						{ condition === 'specific-tab' && (
							<SelectControl
								label={ __( 'Tab', 'hm-url-tabs' ) }
								value={ tabUrl }
								options={ [
									{
										label: __(
											'Select a tab…',
											'hm-url-tabs'
										),
										value: '',
									},
									...tabsForEndpoint
										.filter(
											( tab ) =>
												! tab.isHomeTab &&
												! tab.isBaseTab
										)
										.map( ( tab ) => ( {
											label: tab.label || tab.url,
											value: tab.url,
										} ) ),
								] }
								onChange={ ( value ) =>
									setAttributes( {
										hmUrlTabVisibility: {
											...hmUrlTabVisibility,
											tabUrl: value,
										},
									} )
								}
								help={ __(
									'This block will only be visible when the selected tab is active.',
									'hm-url-tabs'
								) }
							/>
						) }
					</PanelBody>
				</InspectorControls>
			</>
		);
	};
}, 'withTabVisibilityControls' );

addFilter(
	'editor.BlockEdit',
	'hm-url-tabs/tab-visibility-controls',
	withTabVisibilityControls
);

/**
 * Add visibility indicator class to blocks with tab visibility settings.
 */
const withTabVisibilityIndicator = createHigherOrderComponent(
	( BlockListBlock ) => {
		return ( props ) => {
			const { name, clientId } = props;

			// Don't add to navigation-link.
			if ( name === 'core/navigation-link' ) {
				return <BlockListBlock { ...props } />;
			}

			// Get visibility settings and check for tab links on page.
			const { tabs, hasVisibility } = useSelect(
				( select ) => {
					const { getBlocksByName, getBlock } =
						select( 'core/block-editor' );

					// Get all navigation-link block client IDs recursively.
					const navLinkClientIds = getBlocksByName(
						'core/navigation-link'
					);

					// Filter to only tab variations.
					const tabData = navLinkClientIds
						.map( ( id ) => getBlock( id ) )
						.filter(
							( block ) =>
								block?.attributes?.kind === 'tab' ||
								block?.attributes?.kind === 'tab-home' ||
								block?.attributes?.kind === 'tab-base'
						);

					// Get current block's visibility settings.
					const currentBlock = getBlock( clientId );
					const visibility =
						currentBlock?.attributes?.hmUrlTabVisibility;
					const condition = visibility?.condition ?? 'always';

					return {
						tabs: tabData,
						hasVisibility: condition !== 'always',
					};
				},
				[ clientId ]
			);

			// Add class if block has visibility set and page has tabs.
			if ( hasVisibility && tabs.length > 0 ) {
				return (
					<BlockListBlock
						{ ...props }
						className="wp-block-has-hm-tab-visibility"
					/>
				);
			}

			return <BlockListBlock { ...props } />;
		};
	},
	'withTabVisibilityIndicator'
);

addFilter(
	'editor.BlockListBlock',
	'hm-url-tabs/tab-visibility-indicator',
	withTabVisibilityIndicator
);
