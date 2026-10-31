'use client';

import React, { useState, useEffect } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { Calendar, Filter, RotateCcw, ArrowRight } from 'lucide-react';

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
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .preset-group {
          display: inline-flex;
          align-items: center;
          background: #ffffff;
          padding: 3px;
          border-radius: 8px;
          border: 1px solid #e2e8f0;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
          gap: 2px;
        }

        .preset-btn {
          padding: 4px 10px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 500;
          color: #64748b;
          background: transparent;
          border: none;
          cursor: pointer;
          transition: all 0.15s ease;
          white-space: nowrap;
        }

        .preset-btn:hover {
          color: #0f172a;
          background: #f1f5f9;
        }

        .preset-btn.active {
          background: #2563eb;
          color: #ffffff;
          font-weight: 600;
          box-shadow: 0 1px 3px rgba(37, 99, 235, 0.25);
        }

        .date-range-box {
          display: inline-flex;
          align-items: center;
          background: #ffffff;
          padding: 3px 5px 3px 10px;
          border-radius: 8px;
          border: 1px solid #e2e8f0;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
          gap: 6px;
          transition: border-color 0.2s, box-shadow 0.2s;
        }

        .date-range-box:hover,
        .date-range-box:focus-within {
          border-color: #cbd5e1;
          box-shadow: 0 2px 5px rgba(0, 0, 0, 0.06);
        }

        .cal-icon-wrapper {
          display: flex;
          align-items: center;
          justify-content: center;
          color: #64748b;
        }

        :global(.custom-range-input) {
          border: none !important;
          background: transparent !important;
          font-size: 12.5px !important;
          font-weight: 500 !important;
          color: #1e293b !important;
          padding: 4px 4px !important;
          width: 88px !important;
          outline: none !important;
          box-shadow: none !important;
          text-align: center !important;
          cursor: pointer !important;
        }

        :global(.custom-range-input::placeholder) {
          color: #94a3b8 !important;
          font-weight: 400 !important;
        }

        :global(.react-datepicker-popper) {
          z-index: 1050 !important;
        }

        .range-arrow {
          color: #94a3b8;
          flex-shrink: 0;
        }

        .btn-filter-action {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
          color: #ffffff;
          border: none;
          padding: 5px 12px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          box-shadow: 0 1px 3px rgba(37, 99, 235, 0.2);
          transition: all 0.2s ease;
          white-space: nowrap;
        }

        .btn-filter-action:hover {
          background: linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%);
          transform: translateY(-0.5px);
          box-shadow: 0 2px 6px rgba(37, 99, 235, 0.3);
        }

        .btn-clear-action {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 26px;
          height: 26px;
          border-radius: 6px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          color: #64748b;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .btn-clear-action:hover {
          background: #fee2e2;
          color: #ef4444;
          border-color: #fecaca;
        }
      `}</style>

      {/* Preset Quick Filters */}
      <div className="preset-group">
        <button
          type="button"
          className={`preset-btn ${activePreset === 'all' ? 'active' : ''}`}
          onClick={() => handlePreset('all')}
        >
          All Time
        </button>
        <button
          type="button"
          className={`preset-btn ${activePreset === 'today' ? 'active' : ''}`}
          onClick={() => handlePreset('today')}
        >
          Today
        </button>
        <button
          type="button"
          className={`preset-btn ${activePreset === '7d' ? 'active' : ''}`}
          onClick={() => handlePreset('7d')}
        >
          7 Days
        </button>
        <button
          type="button"
          className={`preset-btn ${activePreset === '30d' ? 'active' : ''}`}
          onClick={() => handlePreset('30d')}
        >
          30 Days
        </button>
      </div>

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

        <ArrowRight size={12} className="range-arrow" />

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

