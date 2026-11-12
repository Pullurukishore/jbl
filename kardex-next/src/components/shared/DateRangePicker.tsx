'use client';

import React, { useState, useEffect } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { Calendar, Filter, RotateCcw } from 'lucide-react';

interface DateRangePickerProps {
  onApply: (startDate: Date | null, endDate: Date | null) => void;
  onClear: () => void;
  initialStartDate?: Date | null;
  initialEndDate?: Date | null;
}

export const DateRangePicker: React.FC<DateRangePickerProps> = ({
  onApply,
  onClear,
  initialStartDate = null,
  initialEndDate = null,
}) => {
  const [startDate, setStartDate] = useState<Date | null>(initialStartDate);
  const [endDate, setEndDate] = useState<Date | null>(initialEndDate);
  const [activePreset, setActivePreset] = useState<'all' | 'today' | '7d' | '30d' | 'custom'>('all');

  useEffect(() => {
    if (!startDate && !endDate) {
      setActivePreset('all');
    }
  }, [startDate, endDate]);

  const handleApply = () => {
    onApply(startDate, endDate);
  };

  const handleClear = () => {
    setStartDate(null);
    setEndDate(null);
    setActivePreset('all');
    onClear();
  };

  const handlePreset = (preset: 'all' | 'today' | '7d' | '30d') => {
    setActivePreset(preset);

    if (preset === 'all') {
      setStartDate(null);
      setEndDate(null);
      onClear();
      return;
    }

    const now = new Date();
    let start: Date;
    let end: Date = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    if (preset === 'today') {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    } else if (preset === '7d') {
      start = new Date();
      start.setDate(now.getDate() - 7);
      start.setHours(0, 0, 0, 0);
    } else {
      // 30d
      start = new Date();
      start.setDate(now.getDate() - 30);
      start.setHours(0, 0, 0, 0);
    }

    setStartDate(start);
    setEndDate(end);
    onApply(start, end);
  };

  return (
    <div className="filter-bar-wrapper">
      <style jsx>{`
        .filter-bar-wrapper {
          display: inline-flex;
          align-items: center;
          background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 4px 6px 4px 4px;
          box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04), 0 4px 10px rgba(15, 23, 42, 0.03);
          gap: 8px;
          flex-wrap: wrap;
        }

        .preset-group {
          display: inline-flex;
          align-items: center;
          background: #f1f5f9;
          padding: 3px;
          border-radius: 9px;
          border: 1px solid #e2e8f0;
          gap: 2px;
        }

        .preset-btn {
          padding: 5px 11px;
          border-radius: 7px;
          font-size: 12px;
          font-weight: 600;
          color: #64748b;
          background: transparent;
          border: none;
          cursor: pointer;
          transition: all 0.15s ease;
          white-space: nowrap;
        }

        .preset-btn:hover {
          color: #0f172a;
          background: rgba(255, 255, 255, 0.75);
        }

        .preset-btn.active {
          background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
          color: #ffffff;
          font-weight: 700;
          box-shadow: 0 2px 6px rgba(37, 99, 235, 0.28);
        }

        .toolbar-divider {
          width: 1px;
          height: 22px;
          background: #e2e8f0;
          flex-shrink: 0;
        }

        .date-range-box {
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }

        .cal-icon-wrapper {
          width: 28px;
          height: 28px;
          border-radius: 8px;
          background: #eff6ff;
          color: #2563eb;
          border: 1px solid rgba(37, 99, 235, 0.15);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        :global(.custom-range-input) {
          border: 1px solid #e2e8f0 !important;
          background: #ffffff !important;
          border-radius: 7px !important;
          font-size: 12px !important;
          font-weight: 600 !important;
          color: #1e293b !important;
          padding: 5px 8px !important;
          width: 96px !important;
          outline: none !important;
          box-shadow: none !important;
          text-align: center !important;
          cursor: pointer !important;
          transition: border-color 0.15s ease, box-shadow 0.15s ease !important;
        }

        :global(.custom-range-input:hover) {
          border-color: #cbd5e1 !important;
        }

        :global(.custom-range-input:focus) {
          border-color: #3b82f6 !important;
          box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.15) !important;
        }

        :global(.custom-range-input::placeholder) {
          color: #94a3b8 !important;
          font-weight: 500 !important;
        }

        :global(.react-datepicker-popper) {
          z-index: 1050 !important;
        }

        .range-sep {
          font-size: 11px;
          font-weight: 700;
          color: #94a3b8;
          text-transform: uppercase;
          letter-spacing: 0.3px;
          padding: 0 1px;
        }

        .btn-filter-action {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
          color: #ffffff;
          border: none;
          padding: 6px 13px;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          box-shadow: 0 2px 6px rgba(37, 99, 235, 0.25);
          transition: all 0.18s ease;
          white-space: nowrap;
        }

        .btn-filter-action:hover {
          background: linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%);
          transform: translateY(-1px);
          box-shadow: 0 4px 10px rgba(37, 99, 235, 0.32);
        }

        .btn-clear-action {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          border-radius: 8px;
          background: #ffffff;
          border: 1px solid #e2e8f0;
          color: #64748b;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .btn-clear-action:hover {
          background: #fef2f2;
          color: #ef4444;
          border-color: #fecaca;
        }
      `}</style>

      {/* Preset Quick Filters */}
      <div className="preset-group">
        {[
          { key: 'all' as const, label: 'All Time' },
          { key: 'today' as const, label: 'Today' },
          { key: '7d' as const, label: '7 Days' },
          { key: '30d' as const, label: '30 Days' },
        ].map((item) => (
          <button
            key={item.key}
            type="button"
            className={`preset-btn ${activePreset === item.key ? 'active' : ''}`}
            onClick={() => handlePreset(item.key)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="toolbar-divider d-none d-md-block" />

      {/* Custom Date Range Picker */}
      <div className="date-range-box">
        <div className="cal-icon-wrapper">
          <Calendar size={14} />
        </div>

        <DatePicker
          selected={startDate}
          onChange={(date: Date | null) => {
            setStartDate(date);
            setActivePreset('custom');
          }}
          selectsStart
          startDate={startDate}
          endDate={endDate}
          placeholderText="Start Date"
          dateFormat="yyyy-MM-dd"
          className="custom-range-input"
        />

        <span className="range-sep">to</span>

        <DatePicker
          selected={endDate}
          onChange={(date: Date | null) => {
            setEndDate(date);
            setActivePreset('custom');
          }}
          selectsEnd
          startDate={startDate}
          endDate={endDate}
          minDate={startDate || undefined}
          placeholderText="End Date"
          dateFormat="yyyy-MM-dd"
          className="custom-range-input"
        />

        <button
          type="button"
          className="btn-filter-action"
          onClick={handleApply}
          title="Apply date filter"
        >
          <Filter size={12} />
          <span>Filter</span>
        </button>

        {(startDate || endDate || activePreset !== 'all') && (
          <button
            type="button"
            className="btn-clear-action"
            onClick={handleClear}
            title="Reset to all time"
          >
            <RotateCcw size={12} />
          </button>
        )}
      </div>
    </div>
  );
};

