import { selectors as constantSelectors } from '../../store/constants';
import * as helpers from './helpers';
import * as selectors from './selectors';
import store from '../../store';


export const actions = {
	SET_CORE_VERSION: 'SET_CORE_VERSION',
	COMPATIBLE_COMPONENTS_LOADED: 'COMPATIBLE_COMPONENTS_LOADED',
	COMPATIBLE_COMPONENTS_LOAD_ERROR: 'COMPATIBLE_COMPONENTS_LOAD_ERROR',
	TOGGLE_API: 'TOGGLE_API',
	TOGGLE_MODULE: 'TOGGLE_MODULE',
	TOGGLE_THEME: 'TOGGLE_THEME',
	EDIT_SELECTED_COMPONENT_LIST: 'EDIT_SELECTED_COMPONENT_LIST',
	SAVE_SELECTED_COMPONENT_LIST: 'SAVE_SELECTED_COMPONENT_LIST',
	CANCEL_EDIT_SELECTED_COMPONENT_LIST: 'CANCEL_EDIT_SELECTED_COMPONENT_LIST',
	SELECT_COMPONENT_TYPE_SECTION: 'SELECT_COMPONENT_TYPE_SECTION',
	SELECT_COMPONENT_TYPE_SECTIONS: 'SELECT_COMPONENT_TYPE_SECTIONS',
	TOGGLE_COMPONENT_TYPE_SECTION: 'TOGGLE_COMPONENT_TYPE_SECTION',
	SELECT_ALL_MODULES: 'SELECT_ALL_MODULES',
	DESELECT_ALL_MODULES: 'DESELECT_ALL_MODULES',
	INIT_SELECTED_COMPONENTS: 'INIT_SELECTED_COMPONENTS',
	SHOW_COMPONENT_CHANGELOG_MODAL: 'SHOW_COMPONENT_CHANGELOG_MODAL',
	COMPONENT_HISTORY_LOADED: 'COMPONENT_HISTORY_LOADED',
	CLOSE_COMPONENT_CHANGELOG_MODAL: 'CLOSE_COMPONENT_CHANGELOG_MODAL',
	START_DOWNLOAD_COMPATIBLE_COMPONENTS: 'START_DOWNLOAD_COMPATIBLE_COMPONENTS',
	COMPONENT_DOWNLOAD_UNPACK_RESPONSE: 'COMPONENT_DOWNLOAD_UNPACK_RESPONSE', // TODO rename: SUCCESS/ERROR ?
	TOGGLE_SHOW_DETAILED_DOWNLOAD_LOG: 'TOGGLE_SHOW_DETAILED_DOWNLOAD_LOG',
	INSTALLED_COMPONENTS_LOADED: 'INSTALLED_COMPONENTS_LOADED',
	INSTALLED_COMPONENTS_ERROR_LOADING: 'INSTALLED_COMPONENTS_ERROR_LOADING'
};


/**
 * Used during installation. Gets the list of components compatible with the current core version and initializes
 * the store into a state ready to view + manage the data.
 * @return {Function}
 */
const getInstallationComponentList = () => {
	return function (dispatch, getState) {
		const state = getState();
		const base_url = state.constants.data_source_url;
		const coreVersion = state.constants.core_version; // TODO convert to camel

		dispatch(setCoreVersion(coreVersion));

		dispatch({
			type: actions.SELECT_COMPONENT_TYPE_SECTIONS,
			payload: {
				sections: ['module']
			}
		});

		fetch(`${base_url}/feeds/core/${coreVersion}.json`)
			.then((response) => response.json())
			.then((json) => {

				// first log the full list of compatible components in the store
				dispatch({
					type: actions.COMPATIBLE_COMPONENTS_LOADED,
					payload: {
						coreVersion: coreVersion,
						api: json.api,
						modules: json.modules,
						themes: json.themes
					}
				});

				// next, flag specific components as being selected by default. These are defined per Core version
				// in the Form Tools CMS, providing the user with some default recommendations
				const selectedModuleFolders = json.default_components.modules.filter((module) => {
					return json.modules.find((row) => module === row.folder) !== undefined;
				});
				const selectedThemeFolders = json.default_components.themes.filter((theme) => {
					return json.themes.find((row) => theme === row.folder) !== undefined;
				});

				dispatch({
					type: actions.INIT_SELECTED_COMPONENTS,
					payload: {
						coreSelected: false,
						apiSelected: json.default_components.api,
						selectedModuleFolders,
						selectedThemeFolders
					}
				});
			}).catch((e) => {
				dispatch(compatibleComponentsLoadError(e));
			});
	};
};


/**
 * Used during installation. Gets the list of components compatible with the current core version and initializes
 * the store into a state ready to view + manage the data.
 * @return {Function}
 */
const getManageComponentsList = () => {
	return function (dispatch, getState) {
		const state = getState();
		const base_url = state.constants.data_source_url;
		const coreVersion = state.constants.core_version;

		dispatch(setCoreVersion(coreVersion));

		fetch(`${base_url}/feeds/core/${coreVersion}.json`)
			.then((response) => response.json())
			.then((json) => {
				// first log the full list of compatible components in the store
				dispatch({
					type: actions.COMPATIBLE_COMPONENTS_LOADED,
					payload: {
						coreVersion: coreVersion,
						api: json.api,
						modules: json.modules,
						themes: json.themes
					}
				});
			}).catch((e) => {
				dispatch(compatibleComponentsLoadError(e));
			});
	};
};


const compatibleComponentsLoadError = () => ({ type: actions.COMPATIBLE_COMPONENTS_LOAD_ERROR });
const toggleAPI = () => ({ type: actions.TOGGLE_API });
const toggleModule = (folder) => ({ type: actions.TOGGLE_MODULE, folder });
const toggleTheme = (folder) => ({ type: actions.TOGGLE_THEME, folder });
const setCoreVersion = (coreVersion) => ({
	type: actions.SET_CORE_VERSION,
	payload: { coreVersion }
});

const toggleComponent = (componentTypeSection, folder) => {
	if (componentTypeSection === 'module') {
		return toggleModule(folder);
	} else if (componentTypeSection === 'theme') {
		return toggleTheme(folder);
	} else {
		return toggleAPI();
	}
};

const editSelectedComponentList = () => ({ type: actions.EDIT_SELECTED_COMPONENT_LIST });

const saveSelectedComponentList = () => ({ type: actions.SAVE_SELECTED_COMPONENT_LIST });

const cancelEditSelectedComponentList = () => ({ type: actions.CANCEL_EDIT_SELECTED_COMPONENT_LIST });

const selectComponentTypeSection = (section) => ({
	type: actions.SELECT_COMPONENT_TYPE_SECTION,
	payload: {
		section
	}
});

const selectComponentTypeSections = (sections) => ({
	type: actions.SELECT_COMPONENT_TYPE_SECTIONS,
	payload: {
		sections
	}
});

const toggleComponentTypeSection = (section) => ({
	type: actions.TOGGLE_COMPONENT_TYPE_SECTION,
	payload: {
		section
	}
});

const toggleAllModulesSelected = () => {
	return (dispatch, getState) => {
		const allSelected = selectors.allModulesSelected(getState());
		dispatch({
			type: allSelected ? actions.DESELECT_ALL_MODULES : actions.SELECT_ALL_MODULES
		});
	};
};


// folder is the theme/module folder, or "core" or "api"
const showInfoModal = ({ componentType, folder }) => {
	return (dispatch, getState) => {
		const changelogs = selectors.getChangelogs(getState());

		if (!changelogs.hasOwnProperty(folder)) {
			queryComponentInfo(componentType, folder);
		}

		dispatch({
			type: actions.SHOW_COMPONENT_CHANGELOG_MODAL,
			payload: {
				componentType,
				folder
			}
		});
	};
};


// pings the server to get the component history for the Core, API, module or theme
const queryComponentInfo = (componentType, folder) => {
	const url = `../global/code/actions-react.php?action=get_component_info&type=${componentType}&component=${folder}`;

	fetch(url)
		.then((response) => response.json())
		.then((json) => {
			let desc = null, versions = [];
			if (json.success) {
				desc = json.data.hasOwnProperty('desc') ? json.data.desc : null;
				versions = json.data.versions;
			}
			store.dispatch({
				type: actions.COMPONENT_HISTORY_LOADED,
				payload: {
					folder,
					loadSuccess: json.success,
					desc,
					versions
				}
			});
		}).catch(() => {
			// store.dispatch({
			//     type: INIT_DATA_ERROR_LOADING,
			//     error: e
			// });
		});
};

const closeInfoModal = () => ({ type: actions.CLOSE_COMPONENT_CHANGELOG_MODAL });


const onPrevNext = (dir) => {
	return (dispatch, getState) => {
		const prevNext = selectors.getPrevNextComponent(getState());

		if ((dir === 'prev' && prevNext.prev === null) || (dir === 'next' && prevNext.next === null)) {
			return;
		}

		if (dir === 'prev') {
			dispatch(showInfoModal({ ...prevNext.prev }));
		} else {
			dispatch(showInfoModal({ ...prevNext.next }));
		}
	};
};


const downloadCompatibleComponents = () => {
	return (dispatch, getState) => {
		const state = getState();
		const selectedComponents = selectors.getSelectedComponents(state);
		const constants = constantSelectors.getConstants(state);

		let componentList = {};
		selectedComponents.forEach((item) => {
			if (item.type === 'core') {
				return;
			}
			componentList[helpers.getComponentIdentifier(item.folder, item.type)] = {
				downloadSuccess: null, // set to true/false depending on whether the component was successfully updated
				log: []
			};
		});

		dispatch({
			type: actions.START_DOWNLOAD_COMPATIBLE_COMPONENTS,
			payload: { componentList }
		});

		selectedComponents.forEach((item) => {
			if (item.type === 'core') {
				return;
			}
			downloadAndUnpackComponent(item, constants.data_source_url);
		});
	};
};


const downloadAndUnpackComponent = (item, data_source_url) => {
	let folder = '';

	if (item.type === 'api') {
		folder = 'api';
	} else if (item.type === 'module') {
		folder = 'modules';
	} else if (item.type === 'theme') {
		folder = 'themes';
	}
	const zipfile_url = `${data_source_url}/${folder}/${item.folder}-${item.version}.zip`;
	let cleanUrl = encodeURIComponent(zipfile_url);

	const actions_url = `../global/code/actions-react.php?action=installation_download_single_component&type=${item.type}&url=${cleanUrl}`;

	fetch(actions_url)
		.then((response) => response.json())
		.then((json) => {
			store.dispatch({
				type: actions.COMPONENT_DOWNLOAD_UNPACK_RESPONSE,
				payload: {
					...json,
					folder: item.folder,
					type: item.type
				}
			});
		}).catch((e) => {
			// store.dispatch({
			//     type: INIT_DATA_ERROR_LOADING,
			//     error: e
			// });
		});
};


const toggleShowDetailedDownloadLog = () => ({ type: actions.TOGGLE_SHOW_DETAILED_DOWNLOAD_LOG });


const getInstalledComponents = () => {
	fetch(`${g.root_url}/global/code/actions-react.php?action=get_installed_components`)
	  .then((response) => response.json())
	  .then((json) => {
		  store.dispatch({
			  type: actions.INSTALLED_COMPONENTS_LOADED,
			  payload: {
				  components: json
			  }
		  });

		  store.dispatch({
			  type: actions.INIT_SELECTED_COMPONENTS,
			  payload: {
				  coreSelected: true,
				  apiSelected: json.api.installed,
				  selectedModuleFolders: json.modules.map((row) => row.module_folder),
				  selectedThemeFolders: json.themes.filter((row) => row.theme_folder !== 'default').map((row) => row.theme_folder)
			  }
		  });

	  }).catch((e) => {
		// store.dispatch({
		// 	type: actions.INSTALLED_MODULES_ERROR_LOADING, // TODO
		// 	error: e
		// });
	});
};

export const actionCreators = {
	getInstallationComponentList,
	getManageComponentsList,
	setCoreVersion,
	//compatibleComponentsLoadError,
	toggleComponent,
	editSelectedComponentList,
	saveSelectedComponentList,
	cancelEditSelectedComponentList,
	selectComponentTypeSection,
	selectComponentTypeSections,
	toggleComponentTypeSection,
	toggleAllModulesSelected,
	showInfoModal,
	closeInfoModal,
	onPrevNext,
	downloadCompatibleComponents,
	toggleShowDetailedDownloadLog,
	getInstalledComponents
};
