/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';

export type TimeFormat = '12h' | '24h';

interface TimeFormatContextValue {
  timeFormat: TimeFormat;
  setTimeFormat: (format: TimeFormat) => void;
  formatTimeStr: (dateInput: string | Date | number) => string;
  formatDateTimeStr: (dateInput: string | Date | number) => string;
}

const TimeFormatContext = createContext<TimeFormatContextValue | undefined>(undefined);

const STORAGE_KEY = 'intellmeet_time_format';

export const TimeFormatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [timeFormat, setTimeFormatState] = useState<TimeFormat>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === '12h' || saved === '24h') return saved;
    }
    return '12h';
  });

  const setTimeFormat = (format: TimeFormat) => {
    setTimeFormatState(format);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, format);
    }
  };

  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && (e.newValue === '12h' || e.newValue === '24h')) {
        setTimeFormatState(e.newValue);
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const formatTimeStr = useCallback(
    (dateInput: string | Date | number): string => {
      const d = new Date(dateInput);
      if (isNaN(d.getTime())) return String(dateInput);
      if (timeFormat === '24h') {
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
      }
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    },
    [timeFormat]
  );

  const formatDateTimeStr = useCallback(
    (dateInput: string | Date | number): string => {
      const d = new Date(dateInput);
      if (isNaN(d.getTime())) return String(dateInput);
      const datePart = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      const timePart = formatTimeStr(d);
      return `${datePart}, ${timePart}`;
    },
    [formatTimeStr]
  );

  const value = useMemo(
    () => ({
      timeFormat,
      setTimeFormat,
      formatTimeStr,
      formatDateTimeStr,
    }),
    [timeFormat, formatTimeStr, formatDateTimeStr]
  );

  return <TimeFormatContext.Provider value={value}>{children}</TimeFormatContext.Provider>;
};

export const useTimeFormat = (): TimeFormatContextValue => {
  const context = useContext(TimeFormatContext);
  if (!context) {
    // Fallback if rendered outside provider
    return {
      timeFormat: '12h',
      setTimeFormat: () => {},
      formatTimeStr: (d) => new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }),
      formatDateTimeStr: (d) => new Date(d).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }),
    };
  }
  return context;
};
