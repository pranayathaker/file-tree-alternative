import { Plugin, addIcon, TAbstractFile } from 'obsidian';
import { VIEW_TYPE, FileTreeView, ICON } from './FileTreeView';
import { ZoomInIcon, ZoomOutIcon, ZoomOutDoubleIcon, LocationIcon } from './utils/icons';
import { FileTreeAlternativePluginSettings, FileTreeAlternativePluginSettingsTab, DEFAULT_SETTINGS } from './settings';
import { VaultChange } from 'utils/types';

export const eventTypes = {
    activeFileChange: 'fta-active-file-change',
    refreshView: 'fta-refresh-view',
    revealFile: 'fta-reveal-file',
    vaultChange: 'fta-vault-change',
};

export default class FileTreeAlternativePlugin extends Plugin {
    settings: FileTreeAlternativePluginSettings;
    ribbonIconEl: HTMLElement | undefined = undefined;

    keys = {
        activeFolderPathKey: 'fileTreePlugin-ActiveFolderPath',
        pinnedFilesKey: 'fileTreePlugin-PinnedFiles',
        openFoldersKey: 'fileTreePlugin-OpenFolders',
        customHeightKey: 'fileTreePlugin-CustomHeight',
        focusedFolder: 'fileTreePlugin-FocusedFolder',
    };

    async onload() {
        console.log('Loading Alternative File Tree Plugin');

        addIcon('zoomInIcon', ZoomInIcon);
        addIcon('zoomOutIcon', ZoomOutIcon);
        addIcon('zoomOutDoubleIcon', ZoomOutDoubleIcon);
        addIcon('locationIcon', LocationIcon);

        // Load Settings
        this.addSettingTab(new FileTreeAlternativePluginSettingsTab(this.app, this));
        await this.loadSettings();

        // Register File Tree View
        this.registerView(VIEW_TYPE, (leaf) => {
            return new FileTreeView(leaf, this);
        });

        // Event Listeners
        this.app.workspace.onLayoutReady(async () => await this.openFileTreeLeaf(true));

        // Add Command to Open File Tree Leaf
        this.addCommand({
            id: 'open-file-tree-leaf',
            name: 'Open File Tree Leaf',
            callback: async () => await this.openFileTreeLeaf(true),
        });

        // Add Command to Reveal Active File
        this.addCommand({
            id: 'reveal-active-file',
            name: 'Reveal Active File',
            callback: () => {
                // Activate file tree pane
                let leafs = this.app.workspace.getLeavesOfType(VIEW_TYPE);
                if (leafs.length === 0) this.openFileTreeLeaf(true);
                for (let leaf of leafs) {
                    this.app.workspace.revealLeaf(leaf);
                }
                // Run custom event
                let event = new CustomEvent(eventTypes.revealFile, {
                    detail: {
                        // @ts-ignore
                        file: this.app.workspace.getMostRecentlyActiveFile(),
                    },
                });
                window.dispatchEvent(event);
            },
        });

        // Add event listener for vault changes
        this.app.vault.on('create', this.onCreate);
        this.app.vault.on('delete', this.onDelete);
        this.app.vault.on('modify', this.onModify);
        this.app.vault.on('rename', this.onRename);

        // Ribbon Icon For Opening
        this.refreshIconRibbon();
    }

    onunload() {
        console.log('Unloading Alternative File Tree Plugin');
        this.detachFileTreeLeafs();
        // Remove event listeners
        this.app.vault.off('create', this.onCreate);
        this.app.vault.off('delete', this.onDelete);
        this.app.vault.off('modify', this.onModify);
        this.app.vault.off('rename', this.onRename);
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    triggerVaultChangeEvent = (file: TAbstractFile, changeType: VaultChange, oldPath?: string) => {
        let event = new CustomEvent(eventTypes.vaultChange, {
            detail: {
                file: file,
                changeType: changeType,
                oldPath: oldPath ? oldPath : '',
            },
        });
        window.dispatchEvent(event);
    };

    onCreate = (file: TAbstractFile) => this.triggerVaultChangeEvent(file, 'create', '');
    onDelete = (file: TAbstractFile) => this.triggerVaultChangeEvent(file, 'delete', '');
    onModify = (file: TAbstractFile) => this.triggerVaultChangeEvent(file, 'modify', '');
    onRename = (file: TAbstractFile, oldPath: string) => this.triggerVaultChangeEvent(file, 'rename', oldPath);

    refreshIconRibbon = () => {
        this.ribbonIconEl?.remove();
        if (this.settings.ribbonIcon) {
            this.ribbonIconEl = this.addRibbonIcon(ICON, 'File Tree Alternative Plugin', async () => {
                await this.openFileTreeLeaf(true);
            });
        }
    };

    openFileTreeLeaf = async (showAfterAttach: boolean) => {
        let leafs = this.app.workspace.getLeavesOfType(VIEW_TYPE);
        if (leafs.length == 0) {
            // Needs to be mounted
            let leaf = this.app.workspace.getLeftLeaf(false);
            await leaf.setViewState({ type: VIEW_TYPE });
            if (showAfterAttach) this.app.workspace.revealLeaf(leaf);
        } else {
            // Already mounted - needs to be revealed
            leafs.forEach((leaf) => this.app.workspace.revealLeaf(leaf));
        }
    };

    detachFileTreeLeafs = () => {
        let leafs = this.app.workspace.getLeavesOfType(VIEW_TYPE);
        for (let leaf of leafs) {
            (leaf.view as FileTreeView).destroy();
            leaf.detach();
        }
    };

    refreshTreeLeafs = () => {
        this.detachFileTreeLeafs();
        this.openFileTreeLeaf(true);
    };
}
