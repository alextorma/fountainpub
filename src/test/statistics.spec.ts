import { retrieveScreenPlayStatistics } from "../statistics";
import * as fs from "fs"
import * as path from "path"
import * as afterparser from "../afterwriting-parser";
import { ExportConfig, FountainConfig } from "../configloader";

function padZero(i: number) {
    let j: string = i.toFixed(0);
	if (i < 10) {
		j = "0" + j;
	}
	return j;
}
function secondsToString(seconds: number){
	var time = new Date(null as any);
	time.setHours(0);
	time.setMinutes(0);
	time.setSeconds(seconds);
	return padZero(time.getHours()) + ":" + padZero(time.getMinutes()) + ":" + padZero(time.getSeconds());
}

const exportConfig: ExportConfig  =  {
    highlighted_characters: [],
    highlighted_changes: {
        lines: [],
        highlightColor: []
    }
};

const fountainConfig: FountainConfig  = {
    embolden_scene_headers: false,
    embolden_character_names: false,
    show_page_numbers: false,
    split_dialogue: false,
    print_title_page: false,
    print_profile: "a4",
    double_space_between_scenes: false,
    print_sections: false,
    print_synopsis: false,
    print_actions: false,
    print_headers: false,
    print_dialogues: false,
    number_sections: false,
    use_dual_dialogue: false,
    print_notes: false,
    print_header: undefined as unknown as string,
    print_footer: undefined as unknown as string,
    print_watermark: undefined as unknown as string,
    scenes_numbers: "none",
    each_scene_on_new_page: false,
    merge_empty_lines: false,
    print_dialogue_numbers: false,
    create_bookmarks: false,
    invisible_section_bookmarks: false,
    text_more: undefined as unknown as string,
    text_contd: undefined as unknown as string,
    text_scene_continued: undefined as unknown as string,
    scene_continuation_top: false,
    scene_continuation_bottom: false
};

const bigFishAssertions = async(script: string, expectedDuration?: string, expectedWords?: number, expectedActionDuration?: string) => {
    const parsed = afterparser.parse(script, fountainConfig, false);
    const stats = await retrieveScreenPlayStatistics(script, parsed, fountainConfig, exportConfig)
    expect(stats.lengthStats.words).toBe(expectedWords !== undefined ? expectedWords : 26036)
    expect(stats.characterStats.characters.length).toBe(48)
    expect(stats.characterStats.characterCount).toBe(48)
    stats.characterStats.characters.forEach((charStat) => {
        expect(typeof charStat.name).toBe("string")
        expect(charStat.name.length).toBeGreaterThan(0)
        expect(charStat.speakingParts).toBeGreaterThan(0)
        expect(charStat.wordsSpoken).toBeGreaterThan(0)
    })
    expect(stats.sceneStats.scenes.length).toBe(190)
    if (expectedDuration) {
        expect(secondsToString(stats.durationStats.total)).toBe(expectedDuration)
    } else {
        expect(secondsToString(stats.durationStats.total)).toBe("01:59:58")
    }
    expect(secondsToString(stats.durationStats.dialogue)).toBe("00:55:50")
    if (expectedActionDuration) {
        expect(secondsToString(stats.durationStats.action)).toBe(expectedActionDuration)
    } else {
        expect(secondsToString(stats.durationStats.action)).toBe("01:04:08")
    }
}

const brickAndSteelAssertions = async (script: string) => {
    const parsed = afterparser.parse(script, fountainConfig, false);
    const stats = await retrieveScreenPlayStatistics(script, parsed, fountainConfig, exportConfig)
    expect(stats.lengthStats.words).toBe(483)
    expect(stats.characterStats.characterCount).toBe(7)
    expect(stats.characterStats.characters.length).toBe(7)
    stats.characterStats.characters.forEach((charStat) => {
        expect(typeof charStat.name).toBe("string")
        expect(charStat.name.length).toBeGreaterThan(0)
        expect(charStat.speakingParts).toBeGreaterThan(0)
        expect(charStat.wordsSpoken).toBeGreaterThan(0)
    })
    expect(stats.sceneStats.scenes.length).toBe(8)
    expect(secondsToString(stats.durationStats.total)).toBe("00:01:48")
    expect(secondsToString(stats.durationStats.dialogue)).toBe("00:00:38")
    expect(secondsToString(stats.durationStats.action)).toBe("00:01:09")
}

describe("Statistics", () => {
    it("Big Fish CRLF", async () => {
        const bigFish = fs.readFileSync(path.resolve(__dirname, "./scripts/big_fish_crlf.fountain"), "utf-8")
        await bigFishAssertions(bigFish, "01:59:59", 26036, "01:04:08")
    })

    it("Big Fish LF", async() => {
        const bigFish = fs.readFileSync(path.resolve(__dirname, "./scripts/big_fish_lf.fountain"), "utf-8")
        await bigFishAssertions(bigFish, undefined, 26035, "01:04:07")
    })

    it("Brick & Steel CRLF", async() => {
        const bigFish = fs.readFileSync(path.resolve(__dirname, "./scripts/brick_and_steel_crlf.fountain"), "utf-8")
        await brickAndSteelAssertions(bigFish)
    })

    it("Brick & Steel LF",async() => {
        const bigFish = fs.readFileSync(path.resolve(__dirname, "./scripts/brick_and_steel_lf.fountain"), "utf-8")
        await brickAndSteelAssertions(bigFish)
    })

    it("Blank Canvas script", async () => {
        const parsed = afterparser.parse("", fountainConfig, false);
        const stats = await retrieveScreenPlayStatistics("", parsed, fountainConfig, exportConfig)
        expect(stats.characterStats.characterCount).toBe(0)
        expect(stats.sceneStats.scenes.length).toBe(0)
        expect(stats.lengthStats.words).toBe(0)
        expect(secondsToString(stats.durationStats.total)).toBe("00:00:00")
        expect(secondsToString(stats.durationStats.dialogue)).toBe("00:00:00")
        expect(secondsToString(stats.durationStats.action)).toBe("00:00:00")
    })

    it("Almost Blank Canvas script", async () => {
        const parsed = afterparser.parse("2134wrdfhf sdhj;dfshl", fountainConfig, false);
        const stats = await retrieveScreenPlayStatistics("2134wrdfhf sdhj;dfshl", parsed, fountainConfig, exportConfig)
        expect(stats.characterStats.characterCount).toBe(0)
        expect(stats.sceneStats.scenes.length).toBe(0)
        expect(stats.lengthStats.words).toBe(2)
        expect(secondsToString(stats.durationStats.total)).toBe("00:00:01")
        expect(secondsToString(stats.durationStats.dialogue)).toBe("00:00:00")
        expect(secondsToString(stats.durationStats.action)).toBe("00:00:01")
    })
})
