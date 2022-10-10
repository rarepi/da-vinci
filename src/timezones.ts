import tz_data from '../named_timezones.json';
console.debug(`Imported ${tz_data.length} named timezones.`)

/**
 * Represents a named timezone
 */
export class NamedTimeZone {
    public fullName: string;
    public shortName: string;
    public UTCOffset: string;

    /**
     * @param {string} fullName Full time zone name
     * @param {string} shortName Time zone abbreviation
     * @param {string} UTCOffset Offset from the UTC timezone
     */
    constructor(fullName: string, shortName: string, UTCOffset: string) {
        this.fullName = fullName;
        this.shortName = shortName;
        this.UTCOffset = UTCOffset;
    }
}

/**
 * A list of time zone abbreviations and their UTC offsets
 * https://www.timeanddate.com/time/zones/
 */
export const NamedTimeZones: NamedTimeZone[] = [];

for(const tz of tz_data) {
    NamedTimeZones.push(new NamedTimeZone(tz[1], tz[0], tz[2]));
}