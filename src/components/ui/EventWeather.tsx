import { useEffect, useState } from 'react';
import { isPhysicalLocation } from '../../domain/weather';
import { fetchEventWeather, type EventWeatherReading } from '../../services/weather';

// The little sky in the corner of an event card: weather at the event's place (forecast
// for its day when within reach, current conditions otherwise) and the moon's state.
// Async and silent — no place, no network, no reading: no chip.

export const EventWeather = ({ location, dateIso, className = '' }: { location?: string | null; dateIso?: string; className?: string }) => {
    const [reading, setReading] = useState<EventWeatherReading | null>(null);

    useEffect(() => {
        if (!isPhysicalLocation(location)) return;
        let alive = true;
        fetchEventWeather(location!.trim(), dateIso).then(r => { if (alive) setReading(r); });
        return () => { alive = false; };
    }, [location, dateIso]);

    if (!reading) return null;
    return (
        <span
            className={`inline-flex items-center gap-1 whitespace-nowrap text-xs ${className}`}
            title={`${reading.place}: ${reading.label.toLowerCase()}, ${Math.round(reading.tempC)}°C ${reading.kind === 'forecast' ? '(forecast for the event day)' : '(there now)'} · ${reading.moon.name}`}
        >
            <span>{reading.emoji}</span>
            <span className="font-medium">{Math.round(reading.tempC)}°</span>
            <span aria-label={reading.moon.name}>{reading.moon.emoji}</span>
        </span>
    );
};
