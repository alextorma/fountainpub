'use strict';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import * as toml from '@iarna/toml';

export class FountainConfig {
    embolden_scene_headers: boolean;
    embolden_character_names: boolean;
    show_page_numbers: boolean;
    split_dialogue: boolean;
    print_title_page: boolean;
    print_profile: 'a4' | 'usletter';
    double_space_between_scenes: boolean;
    print_sections: boolean;
    print_synopsis: boolean;
    print_actions: boolean;
    print_headers: boolean;
    print_dialogues: boolean;
    number_sections: boolean;
    use_dual_dialogue: boolean;
    print_notes: boolean;
    print_header: string;
    print_footer: string;
    print_watermark: string;
    scenes_numbers: 'none' | 'left' | 'right' | 'both';
    each_scene_on_new_page: boolean;
    merge_empty_lines: boolean;
    print_dialogue_numbers: boolean;
    create_bookmarks: boolean;
    invisible_section_bookmarks: boolean;
    text_more: string;
    text_contd: string;
    text_scene_continued: string;
    scene_continuation_top: boolean;
    scene_continuation_bottom: boolean;
}

const defaultConfig: FountainConfig = {
    embolden_scene_headers: true,
    embolden_character_names: false,
    show_page_numbers: true,
    split_dialogue: true,
    print_title_page: true,
    print_profile: 'usletter',
    double_space_between_scenes: false,
    print_sections: false,
    print_synopsis: false,
    print_actions: true,
    print_headers: true,
    print_dialogues: true,
    number_sections: false,
    use_dual_dialogue: true,
    print_notes: false,
    print_header: '',
    print_footer: '',
    print_watermark: '',
    scenes_numbers: 'both',
    each_scene_on_new_page: false,
    merge_empty_lines: true,
    print_dialogue_numbers: false,
    create_bookmarks: true,
    invisible_section_bookmarks: true,
    text_more: 'MORE',
    text_contd: "CONT'D",
    text_scene_continued: 'CONTINUED',
    scene_continuation_top: false,
    scene_continuation_bottom: false
};

export class ExportConfig {
    highlighted_characters: Array<String>;
    highlighted_changes: { lines: Array<number>, highlightColor: Array<number> };
}

function loadConfigFile(configPath: string): Partial<FountainConfig> {
    try {
        const content = fs.readFileSync(configPath, 'utf8');
        const ext = path.extname(configPath).toLowerCase();
        
        switch (ext) {
            case '.json':
                return JSON.parse(content);
            case '.yaml':
            case '.yml':
                return yaml.load(content) as Partial<FountainConfig>;
            case '.toml':
                return toml.parse(content) as Partial<FountainConfig>;
            default:
                // Try parsing as JSON first, then YAML, then TOML
                try {
                    return JSON.parse(content);
                } catch {
                    try {
                        return yaml.load(content) as Partial<FountainConfig>;
                    } catch {
                        return toml.parse(content) as Partial<FountainConfig>;
                    }
                }
        }
    } catch (error) {
        console.warn(`Warning: Could not parse config file ${configPath}:`, error);
        return {};
    }
}

export function getFountainConfig(sourcePath?: string): FountainConfig {
    if (!sourcePath) {
        return defaultConfig;
    }

    // console.log('DEBUG CONFIG: Loading config for source:', sourcePath); // DEBUG

    // Start with default config
    let config = { ...defaultConfig };

    // Collect all config files from source directory up to filesystem root
    const configFiles: string[] = [];
    const sourceDir = path.dirname(sourcePath);
    let currentPath = sourceDir;
    
    // console.log('DEBUG CONFIG: Starting search from:', sourceDir); // DEBUG
    
    // Continue until we've checked the root directory
    while (true) {
        // console.log('DEBUG CONFIG: Checking directory:', currentPath); // DEBUG
        // Check for config files in current directory
        const configPaths = [
            path.join(currentPath, '.fountainpubrc'),
            path.join(currentPath, '.fountainpubrc.json'),
            path.join(currentPath, '.fountainpubrc.yaml'),
            path.join(currentPath, '.fountainpubrc.yml'),
            path.join(currentPath, '.fountainpubrc.toml')
        ];
        
        for (const configPath of configPaths) {
            if (fs.existsSync(configPath)) {
                // console.log('DEBUG CONFIG: Found config file:', configPath); // DEBUG
                configFiles.push(configPath);
                break; // Only one config file per directory
            }
        }
        
        // Stop if we've reached the filesystem root
        const parentPath = path.dirname(currentPath);
        if (parentPath === currentPath) {
            break;
        }
        currentPath = parentPath;
    }

    // Apply configs from root to source directory (higher priority overrides lower)
    // Reverse the array so we apply from root down to source directory
    // console.log('DEBUG CONFIG: Found config files:', configFiles); // DEBUG
    configFiles.reverse().forEach(configPath => {
        // console.log('DEBUG CONFIG: Loading config:', configPath); // DEBUG
        const partialConfig = loadConfigFile(configPath);
        // console.log('DEBUG CONFIG: Loaded config:', partialConfig); // DEBUG
        config = { ...config, ...partialConfig };
    });

    // console.log('DEBUG CONFIG: Final config scenes_numbers:', config.scenes_numbers); // DEBUG
    return config;
}
