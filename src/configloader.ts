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

function findConfigFile(startPath: string): string | null {
    let currentPath = startPath;
    while (currentPath !== path.parse(currentPath).root) {
        // Check for all supported config file formats
        const configPaths = [
            path.join(currentPath, '.fountainpubrc'),
            path.join(currentPath, '.fountainpubrc.json'),
            path.join(currentPath, '.fountainpubrc.yaml'),
            path.join(currentPath, '.fountainpubrc.yml'),
            path.join(currentPath, '.fountainpubrc.toml')
        ];
        
        for (const configPath of configPaths) {
            if (fs.existsSync(configPath)) {
                return configPath;
            }
        }
        currentPath = path.dirname(currentPath);
    }
    return null;
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

    // Start with default config
    let config = { ...defaultConfig };

    // Find and load all config files from root to source directory
    const sourceDir = path.dirname(sourcePath);
    let currentPath = sourceDir;
    const configs: Partial<FountainConfig>[] = [];
    const visitedPaths = new Set<string>();

    while (currentPath !== path.parse(currentPath).root) {
        // Prevent infinite loops by checking if we've already visited this path
        if (visitedPaths.has(currentPath)) {
            break;
        }
        visitedPaths.add(currentPath);

        const configPath = findConfigFile(currentPath);
        if (configPath) {
            configs.push(loadConfigFile(configPath));
        }
        
        const parentPath = path.dirname(currentPath);
        // Additional safety check: if dirname returns the same path, we're at the root
        if (parentPath === currentPath) {
            break;
        }
        currentPath = parentPath;
    }

    // Apply configs from root to source (later configs override earlier ones)
    configs.reverse().forEach(partialConfig => {
        config = { ...config, ...partialConfig };
    });

    return config;
}
