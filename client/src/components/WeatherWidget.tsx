import { useEffect, useState } from 'react';
import { useQuery } from "@tanstack/react-query";
import { Cloud, Sun, CloudRain, Wind, Thermometer } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface WeatherData {
  current_weather: {
    temperature: number;
    windspeed: number;
    weathercode: number;
  };
}

const weatherCodes: Record<number, { label: string; icon: typeof Sun }> = {
  0: { label: 'Clear', icon: Sun },
  1: { label: 'Mainly Clear', icon: Sun },
  2: { label: 'Partly Cloudy', icon: Cloud },
  3: { label: 'Overcast', icon: Cloud },
  45: { label: 'Foggy', icon: Cloud },
  48: { label: 'Foggy', icon: Cloud },
  51: { label: 'Light Drizzle', icon: CloudRain },
  53: { label: 'Drizzle', icon: CloudRain },
  55: { label: 'Heavy Drizzle', icon: CloudRain },
  61: { label: 'Light Rain', icon: CloudRain },
  63: { label: 'Rain', icon: CloudRain },
  65: { label: 'Heavy Rain', icon: CloudRain },
  80: { label: 'Showers', icon: CloudRain },
  81: { label: 'Showers', icon: CloudRain },
  82: { label: 'Heavy Showers', icon: CloudRain },
};

export function WeatherWidget() {
  const { data: weather, isLoading, isError } = useQuery<WeatherData>({
    queryKey: ['/api/weather'],
    staleTime: 1000 * 60 * 10, // Cache for 10 minutes
  });

  if (isLoading) {
    return (
      <div className="bg-gradient-to-r from-blue-100 to-blue-50 dark:from-blue-900/20 dark:to-blue-800/10 p-4 rounded-xl">
        <Skeleton className="h-4 w-32 mb-2" />
        <Skeleton className="h-8 w-20" />
      </div>
    );
  }

  if (isError || !weather?.current_weather) {
    return null;
  }

  const { temperature, windspeed, weathercode } = weather.current_weather;
  const weatherInfo = weatherCodes[weathercode] || { label: 'Unknown', icon: Cloud };
  const WeatherIcon = weatherInfo.icon;

  return (
    <div className="bg-gradient-to-r from-blue-100 to-blue-50 dark:from-blue-900/20 dark:to-blue-800/10 p-4 rounded-xl" data-testid="weather-widget">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground font-medium mb-1">Moyock Weather</p>
          <div className="flex items-center gap-2">
            <WeatherIcon className="h-6 w-6 text-primary" />
            <span className="text-2xl font-bold">{Math.round(temperature)}°F</span>
          </div>
          <p className="text-sm text-muted-foreground">{weatherInfo.label}</p>
        </div>
        <div className="text-right text-sm text-muted-foreground">
          <div className="flex items-center gap-1 justify-end">
            <Wind className="h-4 w-4" />
            <span>{Math.round(windspeed)} mph</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default WeatherWidget;
