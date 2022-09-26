import tz_data from '../named_timezones.json';
console.debug(`Imported ${tz_data.length} named timezones.`)

export class NamedTimeZone {
    public fullName: string;
    public shortName: string;
    public UTCOffset: string;

    constructor(fullName: string, shortName: string, UTCOffset: string) {
        this.fullName = fullName;
        this.shortName = shortName;
        this.UTCOffset = UTCOffset;
    }
}

export const NamedTimeZones: NamedTimeZone[] = [];

for(const tz of tz_data) {
    NamedTimeZones.push(new NamedTimeZone(tz[1], tz[0], tz[2]));
}