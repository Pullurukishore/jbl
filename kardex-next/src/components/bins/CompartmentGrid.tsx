'use client';

import React from 'react';
import { Compartment } from '@/types/hu';
import { Check, Plus, Lock, Cpu, Zap, Radio, ArrowUp, ArrowDown } from 'lucide-react';

interface CompartmentGridProps {
  compartments: Compartment[];
  onSelectEmpty?: (compartmentNumber: number) => void;
  onSelectOccupied?: (compartment: Compartment) => void;
  selectedCompartment?: number | null;
  disabled?: boolean;
  huId?: string;
  binName?: string;
  binType?: string;
}

export const CompartmentGrid: React.FC<CompartmentGridProps> = ({
  compartments,
  onSelectEmpty,
  onSelectOccupied,
  selectedCompartment,
  disabled = false,
  huId,
  binName,
  binType,
}) => {
  const isVerticalBin =
    binName === 'CON_BIND' ||
    (binType && binType.toLowerCase().includes('vertical'));

  const layoutMode: 'horizontal' | 'vertical' = isVerticalBin ? 'vertical' : 'horizontal';

  const sortedCompartments = [...compartments].sort(
    (a, b) => a.compartment_number - b.compartment_number
  );

  // Physical Kardex Power Pick System (PPS) 2x15 layout:
  // Top Row (Row 1): Even numbers in ascending order (2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30)
  // Bottom Row (Row 2): Odd numbers in ascending order (1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25, 27, 29)
  const horizontalCompartments = [...sortedCompartments].sort((a, b) => {
    const aIsEven = a.compartment_number % 2 === 0;
    const bIsEven = b.compartment_number % 2 === 0;
    if (aIsEven && !bIsEven) return -1;
    if (!aIsEven && bIsEven) return 1;
    return a.compartment_number - b.compartment_number;
  });

  const isSlotPicked = (c: Compartment) =>
    !!c.serial_number &&
    !c.put?.text_file_downloaded &&
    (c.put?.pick_status === 'PICKED' || c.status === 'EMPTY');

  const isSlotOccupied = (c: Compartment) =>
    c.status === 'OCCUPIED' && !isSlotPicked(c);

  const occupiedCount = compartments.filter(isSlotOccupied).length;
  const pickedCount = compartments.filter(isSlotPicked).length;
  const emptyCount = compartments.length - occupiedCount - pickedCount;

  // Identify the lowest empty slot number to give it the "Next Target" highlight
  const nextTargetComp = !disabled
    ? sortedCompartments.find((c) => !isSlotOccupied(c) && !isSlotPicked(c))?.compartment_number
    : null;

  // Partition compartments for Vertical Layout (Bottom-to-Top: Slots 1–15 & 16–30, with 1 & 16 at bottom)
  const bank1All = compartments.filter((c) => c.compartment_number >= 1 && c.compartment_number <= 15);
  const bank2All = compartments.filter((c) => c.compartment_number >= 16 && c.compartment_number <= 30);

  const bank1Comps = [...bank1All].sort((a, b) => b.compartment_number - a.compartment_number);
  const bank2Comps = [...bank2All].sort((a, b) => b.compartment_number - a.compartment_number);

  const bank1Occupied = bank1All.filter(isSlotOccupied).length;
  const bank2Occupied = bank2All.filter(isSlotOccupied).length;

  const renderVerticalPocket = (comp: Compartment) => {
    const isPicked = isSlotPicked(comp);
    const isOccupied = isSlotOccupied(comp);
    const isSelected = selectedCompartment === comp.compartment_number;
    const isNextTarget = !isOccupied && !isPicked && comp.compartment_number === nextTargetComp;
    const isClickable = !isOccupied && !isPicked && !disabled && !!onSelectEmpty;
    const isOccupiedClickable = isOccupied && !disabled && !!onSelectOccupied;
    const isPickedClickable = isPicked && !disabled && !!onSelectOccupied;

    let pocketClass = 'vertical-pocket-row';
    if (isSelected) {
      pocketClass += ' scanning-active';
    } else if (isOccupied) {
      pocketClass += ' occupied';
    } else if (isPicked) {
      pocketClass += ' picked';
    } else if (isNextTarget) {
      pocketClass += ' next-target';
    } else {
      pocketClass += ' empty-standard';
    }

    if (disabled) {
      pocketClass += ' disabled';
    }

    return (
      <div
        key={comp.id}
        className={pocketClass}
        onClick={() => {
          if (isClickable && onSelectEmpty) {
            onSelectEmpty(comp.compartment_number);
          } else if (isOccupiedClickable && onSelectOccupied) {
            onSelectOccupied(comp);
          } else if (isPickedClickable && onSelectOccupied) {
            onSelectOccupied(comp);
          }
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '2px 8px',
          borderRadius: '5px',
          minHeight: '23px',
          gap: '6px',
          cursor: isClickable || isOccupiedClickable || isPickedClickable ? 'pointer' : 'default',
          border: isSelected
            ? '1.5px solid #60a5fa'
            : isOccupied
              ? '1.5px solid rgba(16, 185, 129, 0.45)'
              : isPicked
                ? '1.5px solid #d97706'
                : isNextTarget
                  ? '1.5px dashed #3b82f6'
                  : '1px solid #1e293b',
          background: isSelected
            ? 'linear-gradient(90deg, #1e3a8a 0%, #172554 100%)'
            : isOccupied
              ? 'linear-gradient(90deg, #091e16 0%, #04140e 65%, #020b08 100%)'
              : isPicked
                ? 'linear-gradient(90deg, #1e1b13 0%, #17130b 100%)'
                : isNextTarget
                  ? 'linear-gradient(90deg, #0f1c38 0%, #091326 100%)'
                  : '#080d19',
          boxShadow: isSelected
            ? '0 0 10px rgba(96, 165, 250, 0.35)'
            : isOccupied
              ? '0 0 6px rgba(16, 185, 129, 0.1)'
              : isPicked
                ? '0 0 6px rgba(217, 119, 6, 0.18)'
                : isNextTarget
                  ? '0 0 6px rgba(59, 130, 246, 0.18)'
                  : 'none',
          transition: 'all 0.14s ease',
        }}
        title={
          isPicked
            ? `Pocket #${comp.compartment_number} | PICKED & VERIFIED | Serial: ${comp.serial_number || 'N/A'} | Model: ${comp.material_name || 'N/A'} (Ready to send to Kardex)`
            : isOccupied
              ? `Pocket #${comp.compartment_number} | LOADED & STORED (PASS) | Serial: ${comp.serial_number || 'N/A'} | Model: ${comp.material_name || 'N/A'}${isOccupiedClickable ? ' (Click to Pick / Unload Part)' : ''}`
              : disabled
                ? `Pocket #${comp.compartment_number} (Locked in Kardex)`
                : isNextTarget
                  ? `Pocket #${comp.compartment_number} [NEXT SCAN TARGET] - Click to scan`
                  : `Pocket #${comp.compartment_number} - Click to scan`
        }
      >
        {/* Left Cluster: Gold Pins, Slot Number Badge, LED Status Dot */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}>
          {/* Gold PCB contact pins */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', opacity: isPicked ? 0.4 : 0.85 }}>
            <div style={{ width: '3px', height: '2px', background: isPicked ? '#64748b' : '#f59e0b', borderRadius: '0.5px' }} />
            <div style={{ width: '3px', height: '2px', background: isPicked ? '#64748b' : '#f59e0b', borderRadius: '0.5px' }} />
            <div style={{ width: '3px', height: '2px', background: isPicked ? '#64748b' : '#f59e0b', borderRadius: '0.5px' }} />
          </div>

          <span
            style={{
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
              fontSize: '9.5px',
              fontWeight: 800,
              padding: '1px 4px',
              borderRadius: '3px',
              letterSpacing: '0.2px',
              color: isPicked
                ? '#fbbf24'
                : isOccupied
                  ? '#34d399'
                  : isSelected || isNextTarget
                    ? '#93c5fd'
                    : '#64748b',
              background: isPicked
                ? 'rgba(120, 53, 15, 0.7)'
                : isOccupied
                  ? 'rgba(6, 78, 59, 0.7)'
                  : isSelected || isNextTarget
                    ? 'rgba(30, 58, 138, 0.7)'
                    : '#0f172a',
              border: isPicked
                ? '1px solid rgba(245, 158, 11, 0.4)'
                : isOccupied
                  ? '1px solid rgba(16, 185, 129, 0.4)'
                  : isSelected || isNextTarget
                    ? '1px solid rgba(59, 130, 246, 0.5)'
                    : '1px solid #1e293b',
            }}
          >
            #{comp.compartment_number < 10 ? `0${comp.compartment_number}` : comp.compartment_number}
          </span>

          {isOccupied && (
            <div
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: '#34d399',
                boxShadow: '0 0 6px #34d399, 0 0 2px #10b981',
              }}
              title="Module Seated - PASS & STORED"
            />
          )}
          {isPicked && (
            <div
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: '#fbbf24',
                boxShadow: '0 0 6px #fbbf24, 0 0 2px #d97706',
              }}
              title="Pick Validated - Ready for Kardex"
            />
          )}
          {isSelected && <Radio size={10} className="text-light" />}
          {!isOccupied && !isPicked && !isSelected && isNextTarget && (
            <Zap size={9} className="text-primary" />
          )}
        </div>

        {/* Center Content: Serial Number and Material / Model Name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, minWidth: 0, margin: '0 4px' }}>
          {isPicked && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, minWidth: 0 }}>
              <span
                style={{
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                  fontSize: '9.5px',
                  fontWeight: 800,
                  color: '#fbbf24',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                ✓ {comp.serial_number || comp.put?.serial_number || 'PICKED PART'}
              </span>
              <span
                style={{
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                  fontSize: '8px',
                  fontWeight: 700,
                  color: '#f59e0b',
                  background: 'rgba(245, 158, 11, 0.15)',
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                  borderRadius: '2px',
                  padding: '0.5px 3px',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {comp.material_name || comp.put?.model_number || 'READY FOR KARDEX'}
              </span>
            </div>
          )}

          {isOccupied && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, minWidth: 0 }}>
              <span
                style={{
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                  fontSize: '9.5px',
                  fontWeight: 800,
                  color: '#ffffff',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {comp.serial_number || 'SEATED PART'}
              </span>
              {(comp.material_name || comp.put?.model_number) && (
                <span
                  style={{
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                    fontSize: '8px',
                    fontWeight: 700,
                    color: '#fbbf24',
                    background: 'rgba(245, 158, 11, 0.15)',
                    border: '1px solid rgba(245, 158, 11, 0.3)',
                    borderRadius: '2px',
                    padding: '0.5px 3px',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                  title={comp.material_name || comp.put?.model_number || ''}
                >
                  {comp.material_name || comp.put?.model_number}
                </span>
              )}
            </div>
          )}

          {isSelected && (
            <span
              style={{
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                fontSize: '9.5px',
                fontWeight: 800,
                color: '#93c5fd',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              Scanning Active Target...
            </span>
          )}

          {!isOccupied && !isPicked && !isSelected && isNextTarget && (
            <span
              style={{
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                fontSize: '9.5px',
                fontWeight: 700,
                color: '#60a5fa',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              + Next Empty Slot (Click to scan)
            </span>
          )}

          {!isOccupied && !isPicked && !isSelected && !isNextTarget && (
            <span
              style={{
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                fontSize: '9.5px',
                fontWeight: 600,
                color: '#475569',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {disabled ? 'Locked in Kardex' : 'Open Slot (Click to scan)'}
            </span>
          )}
        </div>

        {/* Right Cluster: Status Badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
          {isPicked && (
            <span
              style={{
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                fontSize: '8.5px',
                fontWeight: 800,
                padding: '1px 5px',
                borderRadius: '3px',
                color: '#fbbf24',
                background: 'rgba(120, 53, 15, 0.7)',
                border: '1px solid rgba(245, 158, 11, 0.5)',
              }}
            >
              PICKED ✓
            </span>
          )}

          {isOccupied && (
            <span
              style={{
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                fontSize: '8.5px',
                fontWeight: 800,
                padding: '1px 5px',
                borderRadius: '3px',
                color: '#34d399',
                background: 'rgba(6, 78, 59, 0.7)',
                border: '1px solid rgba(16, 185, 129, 0.5)',
              }}
            >
              PASS • STORED
            </span>
          )}

          {isSelected && (
            <span
              style={{
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                fontSize: '8.5px',
                fontWeight: 800,
                padding: '1px 5px',
                borderRadius: '3px',
                color: '#93c5fd',
                background: 'rgba(30, 58, 138, 0.7)',
                border: '1px solid rgba(59, 130, 246, 0.6)',
              }}
            >
              ACTIVE
            </span>
          )}

          {!isOccupied && !isPicked && !isSelected && isNextTarget && (
            <span
              style={{
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                fontSize: '8.5px',
                fontWeight: 800,
                padding: '1px 5px',
                borderRadius: '3px',
                color: '#60a5fa',
                background: 'rgba(30, 58, 138, 0.5)',
                border: '1px dashed #3b82f6',
              }}
            >
              NEXT
            </span>
          )}

          {!isOccupied && !isPicked && !isSelected && !isNextTarget && (
            <span
              style={{
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                fontSize: '8.5px',
                fontWeight: 800,
                padding: '1px 5px',
                borderRadius: '3px',
                color: '#475569',
                background: '#0d1322',
                border: '1px solid #1e293b',
              }}
            >
              {disabled ? 'LOCKED' : 'EMPTY'}
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="esd-tote-container">
      <style jsx>{`
        /* Molded ESD Industrial Tote Outer Casing */
        .esd-tote-container {
          background: linear-gradient(180deg, #111827 0%, #0b0f19 50%, #030712 100%);
          border: 2px solid #1f293d;
          border-radius: 10px;
          padding: 6px 8px;
          box-shadow: 0 8px 24px -6px rgba(0, 0, 0, 0.7),
                      inset 0 1px 1px rgba(255, 255, 255, 0.08),
                      inset 0 -2px 4px rgba(0, 0, 0, 0.9);
          position: relative;
          width: 100%;
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          user-select: none;
          overflow-x: hidden;
          min-width: 0;
        }

        /* Molded Outer Lip & Carry Grips */
        .tote-top-lip {
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: #080d1a;
          border: 1px solid #1e293b;
          border-radius: 6px;
          padding: 3px 8px;
          margin-bottom: 5px;
          box-shadow: inset 0 2px 5px rgba(0, 0, 0, 0.6);
          flex-shrink: 0;
          flex-wrap: wrap;
          gap: 6px;
        }

        .handle-grip-recess {
          width: 28px;
          height: 6px;
          background: #030712;
          border: 1px solid #334155;
          border-radius: 9999px;
          box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.9);
        }

        .tote-spec-label {
          display: flex;
          align-items: center;
          gap: 5px;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          font-size: 9px;
          font-weight: 700;
          color: #94a3b8;
          letter-spacing: 0.3px;
          text-transform: uppercase;
        }

        .esd-badge {
          display: inline-flex;
          align-items: center;
          gap: 2px;
          background: rgba(234, 179, 8, 0.15);
          color: #facc15;
          border: 1px solid rgba(234, 179, 8, 0.35);
          padding: 1px 4px;
          border-radius: 3px;
          font-size: 8px;
          font-weight: 800;
          letter-spacing: 0.4px;
        }

        .tote-telemetry {
          display: flex;
          align-items: center;
          gap: 8px;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          font-size: 8.5px;
          font-weight: 700;
          flex-wrap: wrap;
        }

        .telemetry-loaded {
          color: #34d399;
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .telemetry-empty {
          color: #64748b;
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .indicator-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
        }

        /* Recessed Internal Socket Deck - 2 Rows x 15 Columns */
        .socket-deck {
          background: #040711;
          border: 1.5px solid #1a2234;
          border-radius: 10px;
          padding: 8px 5px;
          box-shadow: inset 0 6px 18px rgba(0, 0, 0, 0.85);
          display: grid;
          grid-template-columns: repeat(15, minmax(0, 1fr));
          grid-template-rows: repeat(2, minmax(145px, 1fr));
          column-gap: 3.5px;
          row-gap: 8px;
          width: 100%;
          min-width: 0;
          flex: 1;
          height: 100%;
        }

        /* Individual Physical Socket Pocket */
        .socket-pocket {
          border-radius: 6px;
          height: 100%;
          min-height: 145px;
          padding: 5px 2px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          position: relative;
          transition: all 0.18s cubic-bezier(0.4, 0, 0.2, 1);
          overflow: hidden;
          min-width: 0;
        }

        /* OCCUPIED / SEATED PCB CARD */
        .socket-pocket.occupied {
          background: linear-gradient(180deg, #091e16 0%, #04140e 55%, #020b08 100%);
          border: 1.5px solid rgba(16, 185, 129, 0.5);
          box-shadow: 0 0 10px rgba(16, 185, 129, 0.12),
                      inset 0 1px 0 rgba(110, 231, 183, 0.2),
                      inset 0 -2px 4px rgba(0, 0, 0, 0.8);
          cursor: default;
        }

        .socket-pocket.occupied:hover {
          border-color: #10b981;
          box-shadow: 0 0 16px rgba(16, 185, 129, 0.25),
                      inset 0 1px 0 rgba(110, 231, 183, 0.35);
          transform: translateY(-1px);
        }

        /* Top Group in Socket */
        .pocket-top-group {
          display: flex;
          flex-direction: column;
          gap: 2px;
          flex-shrink: 0;
          width: 100%;
        }

        /* PCB Gold Edge Contacts at top of card */
        .pcb-edge-contacts {
          display: flex;
          justify-content: center;
          gap: 1.5px;
          margin-bottom: 2px;
          opacity: 0.85;
        }

        .pcb-pin {
          width: 3px;
          height: 4px;
          background: linear-gradient(180deg, #f59e0b 0%, #d97706 100%);
          border-radius: 1px 1px 0 0;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
        }

        /* Header bar in socket */
        .pocket-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 2px;
          padding: 0 1px;
        }

        .slot-badge-occupied {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          font-size: 8.5px;
          font-weight: 800;
          color: #34d399;
          background: rgba(6, 78, 59, 0.7);
          border: 1px solid rgba(16, 185, 129, 0.4);
          padding: 1px 3px;
          border-radius: 3px;
          letter-spacing: 0.1px;
        }

        .status-led-green {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #34d399;
          box-shadow: 0 0 6px #34d399;
        }

        /* PCB Module Chip Center */
        .pcb-module-body {
          background: linear-gradient(180deg, rgba(6, 78, 59, 0.45) 0%, rgba(4, 40, 30, 0.5) 100%);
          border: 1px solid rgba(16, 185, 129, 0.35);
          border-radius: 6px;
          padding: 6px 2px;
          margin: 3px 0;
          position: relative;
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: space-evenly;
          align-items: center;
          gap: 3px;
          overflow: hidden;
          min-width: 0;
          box-shadow: inset 0 1px 3px rgba(110, 231, 183, 0.08);
        }

        .unit-data-group {
          display: flex;
          flex-direction: column;
          align-items: center;
          width: 100%;
          min-width: 0;
        }

        .unit-field-label {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          font-size: 6.5px;
          font-weight: 800;
          color: #6ee7b7;
          letter-spacing: 0.5px;
          text-transform: uppercase;
          line-height: 1;
          margin-bottom: 1.5px;
          opacity: 0.85;
        }

        .pcb-ic-notch {
          width: 65%;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(52, 211, 153, 0.35), transparent);
          margin: 1px 0;
        }

        .unit-pass-pill {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 2px;
          background: rgba(16, 185, 129, 0.22);
          border: 1px solid rgba(16, 185, 129, 0.45);
          color: #34d399;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          font-size: 7px;
          font-weight: 800;
          padding: 1.5px 4px;
          border-radius: 3px;
          letter-spacing: 0.3px;
          line-height: 1;
        }

        .serial-code-text {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          font-size: 9px;
          font-weight: 800;
          color: #ffffff;
          letter-spacing: -0.2px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          line-height: 1.2;
          text-align: center;
          display: block;
          width: 100%;
        }

        .material-code-text {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          font-size: 8px;
          font-weight: 800;
          color: #fbbf24;
          letter-spacing: -0.15px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          line-height: 1.15;
          text-align: center;
          display: inline-block;
          max-width: 100%;
          background: rgba(245, 158, 11, 0.15);
          border: 1px solid rgba(245, 158, 11, 0.3);
          border-radius: 2px;
          padding: 1.5px 3px;
        }

        /* PCB Lower Footer */
        .pocket-footer-occupied {
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-top: 1px solid rgba(16, 185, 129, 0.25);
          padding-top: 2px;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          font-size: 7px;
          line-height: 1;
          gap: 1px;
          white-space: nowrap;
          overflow: hidden;
        }

        .footer-tag-stored {
          color: #6ee7b7;
          font-weight: 800;
          letter-spacing: 0.1px;
        }

        .footer-tag-pass {
          color: #34d399;
          font-weight: 800;
          letter-spacing: 0.1px;
        }

        /* PICKED SOCKET STYLES */
        .socket-pocket.picked {
          background: linear-gradient(180deg, #1e1b13 0%, #17130b 100%);
          border: 1.5px solid #d97706;
          box-shadow: 0 2px 8px rgba(217, 119, 6, 0.25), inset 0 1px 2px rgba(251, 191, 36, 0.2);
        }

        .socket-pocket.picked:hover:not(.disabled) {
          border-color: #f59e0b;
          transform: translateY(-1px);
        }

        .slot-badge-picked {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          font-size: 8.5px;
          font-weight: 800;
          color: #fbbf24;
          background: rgba(120, 53, 15, 0.7);
          border: 1px solid rgba(245, 158, 11, 0.4);
          padding: 1px 3px;
          border-radius: 3px;
          letter-spacing: 0.1px;
        }

        .status-led-amber {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #fbbf24;
          box-shadow: 0 0 6px #fbbf24;
        }

        .pcb-module-body-picked {
          background: linear-gradient(180deg, rgba(120, 53, 15, 0.45) 0%, rgba(69, 26, 3, 0.45) 100%);
          border: 1px solid rgba(245, 158, 11, 0.35);
          border-radius: 6px;
          padding: 6px 2px;
          margin: 3px 0;
          position: relative;
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: space-evenly;
          align-items: center;
          gap: 3px;
          overflow: hidden;
          min-width: 0;
          box-shadow: inset 0 1px 3px rgba(251, 191, 36, 0.08);
        }

        .unit-field-label-picked {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          font-size: 6.5px;
          font-weight: 800;
          color: #fde68a;
          letter-spacing: 0.5px;
          text-transform: uppercase;
          line-height: 1;
          margin-bottom: 1.5px;
          opacity: 0.85;
        }

        .pcb-ic-notch-picked {
          width: 65%;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(245, 158, 11, 0.35), transparent);
          margin: 1px 0;
        }

        .unit-picked-pill {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 2px;
          background: rgba(245, 158, 11, 0.22);
          border: 1px solid rgba(245, 158, 11, 0.45);
          color: #fbbf24;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          font-size: 7px;
          font-weight: 800;
          padding: 1.5px 4px;
          border-radius: 3px;
          letter-spacing: 0.3px;
          line-height: 1;
        }

        .serial-code-text-picked {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          font-size: 9px;
          font-weight: 800;
          color: #ffffff;
          letter-spacing: -0.2px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          line-height: 1.2;
          text-align: center;
          display: block;
          width: 100%;
        }

        .material-code-text-picked {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          font-size: 8px;
          font-weight: 800;
          color: #fbbf24;
          letter-spacing: -0.15px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          line-height: 1.15;
          text-align: center;
          display: inline-block;
          max-width: 100%;
          background: rgba(245, 158, 11, 0.15);
          border: 1px solid rgba(245, 158, 11, 0.3);
          border-radius: 2px;
          padding: 1.5px 3px;
        }

        .pocket-footer-picked {
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-top: 1px solid rgba(245, 158, 11, 0.25);
          padding-top: 2px;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          font-size: 7px;
          line-height: 1;
          gap: 1px;
          white-space: nowrap;
          overflow: hidden;
        }

        .footer-tag-picked {
          color: #fde68a;
          font-weight: 800;
          letter-spacing: 0.1px;
        }

        .footer-tag-out {
          color: #fbbf24;
          font-weight: 800;
          letter-spacing: 0.1px;
        }

        /* NEXT EMPTY TARGET SOCKET */
        .socket-pocket.next-target {
          background: linear-gradient(180deg, #0f1c38 0%, #091326 100%);
          border: 1.5px dashed #3b82f6;
          box-shadow: 0 0 12px rgba(59, 130, 246, 0.22),
                      inset 0 0 8px rgba(59, 130, 246, 0.12);
          cursor: pointer;
          animation: pulseBorder 2.5s infinite;
        }

        @keyframes pulseBorder {
          0%, 100% { border-color: #3b82f6; }
          50% { border-color: #60a5fa; box-shadow: 0 0 16px rgba(59, 130, 246, 0.35); }
        }

        .socket-pocket.next-target:hover {
          background: linear-gradient(180deg, #172a54 0%, #0d1e3d 100%);
          border-color: #93c5fd;
          transform: translateY(-1px);
        }

        .slot-badge-target {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          font-size: 8.5px;
          font-weight: 800;
          color: #93c5fd;
          background: rgba(30, 58, 138, 0.7);
          border: 1px solid rgba(59, 130, 246, 0.5);
          padding: 1px 3px;
          border-radius: 3px;
        }

        .target-indicator-text {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          font-size: 8px;
          font-weight: 800;
          color: #60a5fa;
          display: flex;
          align-items: center;
          gap: 2px;
        }

        .scan-action-center {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 4px 0;
          gap: 3px;
          flex: 1;
        }

        .scan-icon-circle {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: rgba(59, 130, 246, 0.2);
          border: 1px solid rgba(59, 130, 246, 0.4);
          color: #93c5fd;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: transform 0.2s ease;
        }

        .socket-pocket.next-target:hover .scan-icon-circle {
          transform: scale(1.1);
          background: rgba(59, 130, 246, 0.35);
          color: #ffffff;
        }

        .scan-action-title {
          font-size: 9px;
          font-weight: 700;
          color: #bfdbfe;
        }

        .pocket-footer-target {
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-top: 1px solid rgba(59, 130, 246, 0.3);
          padding-top: 2px;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          font-size: 7px;
          color: #93c5fd;
          font-weight: 700;
          line-height: 1;
          white-space: nowrap;
          gap: 1px;
          overflow: hidden;
        }

        /* STANDARD EMPTY SOCKET */
        .socket-pocket.empty-standard {
          background: linear-gradient(180deg, #090e1c 0%, #060914 100%);
          border: 1px solid #1e293b;
          box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.7);
          cursor: pointer;
        }

        .socket-pocket.empty-standard:hover:not(.disabled) {
          border-color: #475569;
          background: linear-gradient(180deg, #0e162b 0%, #090e1c 100%);
          transform: translateY(-1px);
        }

        .slot-badge-empty {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          font-size: 8.5px;
          font-weight: 700;
          color: #64748b;
          background: #0f172a;
          border: 1px solid #1e293b;
          padding: 1px 3px;
          border-radius: 3px;
        }

        .empty-slot-guide {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 4px 0;
          gap: 2px;
          flex: 1;
        }

        .guide-crosshair {
          color: #334155;
          font-size: 16px;
          transition: all 0.2s ease;
        }

        .socket-pocket.empty-standard:hover .guide-crosshair {
          color: #94a3b8;
          transform: scale(1.1);
        }

        .empty-slot-text {
          font-size: 9px;
          font-weight: 600;
          color: #475569;
          transition: color 0.2s ease;
        }

        .socket-pocket.empty-standard:hover .empty-slot-text {
          color: #cbd5e1;
        }

        .pocket-footer-empty {
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-top: 1px solid #1e293b;
          padding-top: 2px;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          font-size: 7px;
          color: #64748b;
          font-weight: 600;
          line-height: 1;
          white-space: nowrap;
          gap: 1px;
          overflow: hidden;
        }

        /* CURRENTLY ACTIVE SCAN MODAL TARGET */
        .socket-pocket.scanning-active {
          background: linear-gradient(180deg, #1e3a8a 0%, #172554 100%);
          border: 1.5px solid #60a5fa;
          box-shadow: 0 0 16px rgba(96, 165, 250, 0.5), inset 0 0 8px rgba(96, 165, 250, 0.3);
          transform: translateY(-1px);
        }

        /* LOCKED STATE (IN KARDEX) */
        .socket-pocket.disabled {
          cursor: not-allowed !important;
          opacity: 0.8;
        }

        .socket-pocket.disabled:hover {
          transform: none !important;
          box-shadow: none !important;
        }

        /* Subfooter Tote Lip */
        .tote-bottom-lip {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-top: 8px;
          padding: 6px 12px;
          background: #080d1a;
          border: 1px solid #1e293b;
          border-radius: 8px;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          font-size: 9px;
          color: #64748b;
          flex-shrink: 0;
          flex-wrap: wrap;
          gap: 6px;
        }

        /* Vertical Deck Layout Container */
        .vertical-deck-container {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
          width: 100%;
          min-width: 680px;
          flex: 1;
        }

        @media (max-width: 768px) {
          .vertical-deck-container {
            grid-template-columns: 1fr;
            min-width: 0;
          }
        }

        .vertical-bank-card {
          background: #040711;
          border: 1.5px solid #1a2234;
          border-radius: 10px;
          padding: 8px;
          box-shadow: inset 0 4px 14px rgba(0, 0, 0, 0.85);
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .bank-card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 6px 8px;
          background: #090f1f;
          border: 1px solid #1e293b;
          border-radius: 7px;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        }

        .bank-header-left {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .bank-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
        }

        .bank-dot-1 {
          background: #3b82f6;
          box-shadow: 0 0 6px #3b82f6;
        }

        .bank-dot-2 {
          background: #8b5cf6;
          box-shadow: 0 0 6px #8b5cf6;
        }

        .bank-title-text {
          font-size: 10.5px;
          font-weight: 800;
          color: #e2e8f0;
          letter-spacing: 0.4px;
        }

        .bank-sub-info {
          font-size: 9.5px;
          font-weight: 700;
          color: #94a3b8;
        }

        .vertical-slots-list {
          display: flex;
          flex-direction: column;
          gap: 2px;
          flex: 1;
        }

        /* Individual Vertical Pocket Row */
        .vertical-pocket-row {
          border-radius: 5px;
          min-height: 23px;
          padding: 2px 8px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 6px;
          position: relative;
          transition: all 0.14s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .vertical-pocket-row.occupied {
          background: linear-gradient(90deg, #091e16 0%, #04140e 65%, #020b08 100%);
          border: 1.5px solid rgba(16, 185, 129, 0.45);
          box-shadow: 0 0 8px rgba(16, 185, 129, 0.1), inset 0 1px 0 rgba(110, 231, 183, 0.15);
        }

        .vertical-pocket-row.occupied:hover {
          border-color: #10b981;
          box-shadow: 0 0 14px rgba(16, 185, 129, 0.22);
          transform: translateY(-1px);
        }

        .vertical-pocket-row.picked {
          background: linear-gradient(90deg, #1e1b13 0%, #17130b 100%);
          border: 1.5px solid #d97706;
          box-shadow: 0 0 8px rgba(217, 119, 6, 0.2);
        }

        .vertical-pocket-row.picked:hover:not(.disabled) {
          border-color: #f59e0b;
          transform: translateY(-1px);
        }

        .vertical-pocket-row.scanning-active {
          background: linear-gradient(90deg, #1e3a8a 0%, #172554 100%);
          border: 1.5px solid #60a5fa;
          box-shadow: 0 0 14px rgba(96, 165, 250, 0.45);
          transform: translateY(-1px);
        }

        .vertical-pocket-row.next-target {
          background: linear-gradient(90deg, #0f1c38 0%, #091326 100%);
          border: 1.5px dashed #3b82f6;
          box-shadow: 0 0 10px rgba(59, 130, 246, 0.2);
          animation: pulseBorder 2.5s infinite;
          cursor: pointer;
        }

        .vertical-pocket-row.next-target:hover {
          background: linear-gradient(90deg, #172a54 0%, #0d1e3d 100%);
          border-color: #93c5fd;
          transform: translateY(-1px);
        }

        .vertical-pocket-row.empty-standard {
          background: rgba(10, 15, 29, 0.6);
          border: 1px solid #1a2333;
        }

        .vertical-pocket-row.empty-standard:hover:not(.disabled) {
          background: #0f172a;
          border-color: #334155;
          transform: translateY(-1px);
        }

        .vertical-pocket-row.disabled {
          opacity: 0.75;
          cursor: not-allowed !important;
        }

        .v-left-cluster {
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 90px;
          flex-shrink: 0;
        }

        .v-pins-strip {
          display: flex;
          flex-direction: column;
          gap: 1.5px;
          opacity: 0.8;
        }

        .v-pin {
          width: 3.5px;
          height: 3.5px;
          background: linear-gradient(180deg, #f59e0b 0%, #d97706 100%);
          border-radius: 1px;
        }

        .v-mid-content {
          display: flex;
          flex-direction: column;
          gap: 2px;
          flex: 1;
          min-width: 0;
        }

        .v-serial-text {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          font-size: 11px;
          font-weight: 800;
          color: #ffffff;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .v-model-text {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          font-size: 9.5px;
          font-weight: 700;
          color: #fbbf24;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .v-right-cluster {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-shrink: 0;
        }

        .v-status-badge {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          font-size: 9px;
          font-weight: 800;
          padding: 2px 6px;
          border-radius: 4px;
          letter-spacing: 0.3px;
          white-space: nowrap;
        }

        .v-badge-occupied {
          color: #34d399;
          background: rgba(6, 78, 59, 0.6);
          border: 1px solid rgba(16, 185, 129, 0.4);
        }

        .v-badge-picked {
          color: #fbbf24;
          background: rgba(120, 53, 15, 0.6);
          border: 1px solid rgba(245, 158, 11, 0.4);
        }

        .v-badge-active {
          color: #93c5fd;
          background: rgba(30, 58, 138, 0.6);
          border: 1px solid rgba(59, 130, 246, 0.5);
        }

        .v-badge-next {
          color: #60a5fa;
          background: rgba(30, 58, 138, 0.4);
          border: 1px dashed #3b82f6;
        }

        .v-badge-empty {
          color: #64748b;
          background: rgba(15, 23, 42, 0.6);
          border: 1px solid #334155;
        }

        .socket-deck-scroll-wrapper {
          width: 100%;
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
          scrollbar-width: thin;
          padding-bottom: 4px;
          flex: 1;
          display: flex;
          flex-direction: column;
          min-height: 0;
        }

        .scroll-hint-pill {
          display: none;
          align-items: center;
          justify-content: center;
          gap: 6px;
          background: rgba(37, 99, 235, 0.15);
          color: #93c5fa;
          border: 1px solid rgba(59, 130, 246, 0.3);
          border-radius: 6px;
          padding: 4px 8px;
          font-size: 11px;
          font-weight: 600;
          margin-bottom: 6px;
          text-align: center;
        }

        @media (max-width: 1100px) {
          .socket-deck {
            min-width: 960px !important;
          }
          .scroll-hint-pill {
            display: flex;
          }
        }

        @media (max-width: 768px) {
          .esd-tote-container {
            padding: 6px !important;
            min-height: auto !important;
          }
          .tote-top-lip {
            padding: 6px 8px !important;
          }
          .handle-grip-recess {
            display: none;
          }
        }

        .vertical-banks-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
          width: 100%;
          flex: 1;
          min-height: 0;
        }

        @media (max-width: 640px) {
          .vertical-banks-grid {
            grid-template-columns: 1fr !important;
            gap: 10px !important;
          }
        }
      `}</style>

      {/* Top Molded Lip with Handle Grips & Spec Information */}
      <div className="tote-top-lip">
        <div className="d-flex align-items-center gap-3">
          <div className="handle-grip-recess" title="Molded Carry Handle Recess" />
          <div className="tote-spec-label">
            <span className="esd-badge">
              <Zap size={11} /> ESD SAFE
            </span>
            <span>
              KARDEX HU-CARRIER // {huId || 'H1'}{binName ? `-${binName}` : ''}
            </span>
          </div>
        </div>

        <div className="tote-telemetry">
          <span className="telemetry-loaded">
            <span className="indicator-dot" style={{ background: '#10b981', boxShadow: '0 0 8px #10b981' }} />
            {occupiedCount} LOADED (PASS)
          </span>
          {pickedCount > 0 && (
            <span style={{ color: '#fbbf24', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 800 }}>
              <span className="indicator-dot" style={{ background: '#f59e0b', boxShadow: '0 0 8px #f59e0b' }} />
              {pickedCount} PICKED (VERIFIED)
            </span>
          )}
          <span className="telemetry-empty">
            <span className="indicator-dot" style={{ background: '#475569' }} />
            {emptyCount} EMPTY
          </span>
          <div className="handle-grip-recess" title="Molded Carry Handle Recess" />
        </div>
      </div>

      {/* Sunken Socket Pocket Deck - Horizontal Matrix Layout (CON_BINC) */}
      {layoutMode === 'horizontal' && (
        <div className="socket-deck-scroll-wrapper">
          <div className="scroll-hint-pill">
            <span>⇄ Swipe or scroll horizontally to view all 15 slots</span>
          </div>
          <div className="socket-deck">
        {horizontalCompartments.map((comp) => {
          const isPicked = isSlotPicked(comp);
          const isOccupied = isSlotOccupied(comp);
          const isSelected = selectedCompartment === comp.compartment_number;
          const isNextTarget = !isOccupied && !isPicked && comp.compartment_number === nextTargetComp;
          const isClickable = !isOccupied && !isPicked && !disabled && !!onSelectEmpty;

          const isEven = comp.compartment_number % 2 === 0;
          const gridRow = isEven ? 1 : 2;
          const gridCol = Math.ceil(comp.compartment_number / 2);

          let pocketClass = 'socket-pocket';
          if (isSelected) {
            pocketClass += ' scanning-active';
          } else if (isOccupied) {
            pocketClass += ' occupied';
          } else if (isPicked) {
            pocketClass += ' picked';
          } else if (isNextTarget) {
            pocketClass += ' next-target';
          } else {
            pocketClass += ' empty-standard';
          }

          if (disabled) {
            pocketClass += ' disabled';
          }

          const isOccupiedClickable = isOccupied && !disabled && !!onSelectOccupied;
          const isPickedClickable = isPicked && !disabled && !!onSelectOccupied;

          return (
            <div
              key={comp.id}
              className={pocketClass}
              onClick={() => {
                if (isClickable && onSelectEmpty) {
                  onSelectEmpty(comp.compartment_number);
                } else if (isOccupiedClickable && onSelectOccupied) {
                  onSelectOccupied(comp);
                } else if (isPickedClickable && onSelectOccupied) {
                  onSelectOccupied(comp);
                }
              }}
              style={{
                gridRow: `${gridRow} / span 1`,
                gridColumn: `${gridCol} / span 1`,
                cursor: isClickable || isOccupiedClickable || isPickedClickable ? 'pointer' : 'default',
              }}
              title={
                isPicked
                  ? `Pocket #${comp.compartment_number} | PICKED & VERIFIED | Serial: ${comp.serial_number || 'N/A'} | Model: ${comp.material_name || 'N/A'} (Ready to send to Kardex)`
                  : isOccupied
                    ? `Pocket #${comp.compartment_number} | LOADED & STORED (PASS) | Serial: ${comp.serial_number || 'N/A'} | Model: ${comp.material_name || 'N/A'}${isOccupiedClickable ? ' (Click to Pick / Unload Part)' : ''}`
                    : disabled
                      ? `Pocket #${comp.compartment_number} (Locked in Kardex)`
                      : isNextTarget
                        ? `Pocket #${comp.compartment_number} [NEXT SCAN TARGET] - Click to scan`
                        : `Pocket #${comp.compartment_number} - Click to scan`
              }
            >
              {/* === PICKED: PCB ADAPTER CARD VALIDATED AND PICKED === */}
              {isPicked && (
                <>
                  <div className="pocket-top-group">
                    <div className="pcb-edge-contacts" style={{ opacity: 0.5 }}>
                      <div className="pcb-pin" style={{ background: '#94a3b8' }} />
                      <div className="pcb-pin" style={{ background: '#94a3b8' }} />
                      <div className="pcb-pin" style={{ background: '#94a3b8' }} />
                      <div className="pcb-pin" style={{ background: '#94a3b8' }} />
                    </div>

                    <div className="pocket-header">
                      <span className="slot-badge-picked">
                        #{comp.compartment_number < 10 ? `0${comp.compartment_number}` : comp.compartment_number}
                      </span>
                      <div className="status-led-amber" title="Pick Validated - Ready for Kardex" />
                    </div>
                  </div>

                  <div
                    className="pcb-module-body-picked"
                    title={`Picked Serial: ${comp.serial_number || comp.put?.serial_number || 'N/A'}\nModel: ${comp.material_name || comp.put?.model_number || 'N/A'}`}
                  >
                    <div className="unit-data-group">
                      <span className="unit-field-label-picked">SERIAL</span>
                      <span className="serial-code-text-picked" title={comp.serial_number || comp.put?.serial_number || ''}>
                        ✓ {comp.serial_number || comp.put?.serial_number || 'PICKED'}
                      </span>
                    </div>

                    <div className="pcb-ic-notch-picked" />

                    <div className="unit-data-group">
                      <span className="unit-field-label-picked">MODEL</span>
                      <span className="material-code-text-picked" title={comp.material_name || comp.put?.model_number || ''}>
                        {comp.material_name || comp.put?.model_number || 'N/A'}
                      </span>
                    </div>

                    <div className="unit-picked-pill">
                      <span>OUT ✓</span>
                    </div>
                  </div>

                  <div className="pocket-footer-picked">
                    <span className="footer-tag-picked">PICKED</span>
                    <span className="footer-tag-out">OUT</span>
                  </div>
                </>
              )}

              {/* === OCCUPIED: SEATED PCB ADAPTER CARD (PUT) === */}
              {isOccupied && (
                <>
                  <div className="pocket-top-group">
                    {/* Simulated Gold PCB Pin Contacts */}
                    <div className="pcb-edge-contacts">
                      <div className="pcb-pin" />
                      <div className="pcb-pin" />
                      <div className="pcb-pin" />
                      <div className="pcb-pin" />
                    </div>

                    <div className="pocket-header">
                      <span className="slot-badge-occupied">
                        #{comp.compartment_number < 10 ? `0${comp.compartment_number}` : comp.compartment_number}
                      </span>
                      <div className="status-led-green" title="Module Seated - PASS & STORED" />
                    </div>
                  </div>

                  <div
                    className="pcb-module-body"
                    title={`Serial: ${comp.serial_number || 'N/A'}\nModel: ${comp.material_name || comp.put?.model_number || 'N/A'}\nStatus: PASS & STORED`}
                  >
                    <div className="unit-data-group">
                      <span className="unit-field-label">SERIAL</span>
                      <span className="serial-code-text" title={comp.serial_number || ''}>
                        {comp.serial_number || 'SEATED'}
                      </span>
                    </div>

                    <div className="pcb-ic-notch" />

                    <div className="unit-data-group">
                      <span className="unit-field-label">MODEL</span>
                      <span className="material-code-text" title={comp.material_name || comp.put?.model_number || ''}>
                        {comp.material_name || comp.put?.model_number || 'N/A'}
                      </span>
                    </div>

                    <div className="unit-pass-pill">
                      <Check size={8} strokeWidth={3} />
                      <span>PASS</span>
                    </div>
                  </div>

                  <div className="pocket-footer-occupied">
                    <span className="footer-tag-stored">STORED</span>
                    <span className="footer-tag-pass">PASS</span>
                  </div>
                </>
              )}

              {/* === SCANNING ACTIVE MODAL STATE === */}
              {!isOccupied && isSelected && (
                <>
                  <div className="pocket-header">
                    <span className="slot-badge-target">
                      #{comp.compartment_number < 10 ? `0${comp.compartment_number}` : comp.compartment_number}
                    </span>
                    <Radio size={11} className="text-light" />
                  </div>
                  <div className="scan-action-center">
                    <div className="scan-icon-circle">
                      <Cpu size={11} />
                    </div>
                    <span className="scan-action-title">Scanning...</span>
                  </div>
                  <div className="pocket-footer-target">
                    <span>SCAN</span>
                    <span>ACTIVE</span>
                  </div>
                </>
              )}

              {/* === NEXT EMPTY TARGET IN LINE === */}
              {!isOccupied && !isSelected && isNextTarget && (
                <>
                  <div className="pocket-header">
                    <span className="slot-badge-target">
                      #{comp.compartment_number < 10 ? `0${comp.compartment_number}` : comp.compartment_number}
                    </span>
                    <span className="target-indicator-text">
                      <Zap size={8} /> NEXT
                    </span>
                  </div>

                  <div className="scan-action-center">
                    <div className="scan-icon-circle">
                      <Plus size={11} />
                    </div>
                    <span className="scan-action-title">Click</span>
                  </div>

                  <div className="pocket-footer-target">
                    <span>NEXT</span>
                    <span>SLOT</span>
                  </div>
                </>
              )}

              {/* === STANDARD EMPTY SOCKET === */}
              {!isOccupied && !isSelected && !isNextTarget && (
                <>
                  <div className="pocket-header">
                    <span className="slot-badge-empty">
                      #{comp.compartment_number < 10 ? `0${comp.compartment_number}` : comp.compartment_number}
                    </span>
                    {disabled ? (
                      <Lock size={12} className="text-muted" />
                    ) : (
                      <Plus size={12} className="text-muted" />
                    )}
                  </div>

                  <div className="empty-slot-guide">
                    <div className="guide-crosshair">+</div>
                    <span className="empty-slot-text">
                      {disabled ? 'Locked' : 'Scan Unit'}
                    </span>
                  </div>

                  <div className="pocket-footer-empty">
                    <span>OPEN</span>
                    <span>EMPTY</span>
                  </div>
                </>
              )}
            </div>
          );
        })}
          </div>
        </div>
      )}

      {/* Vertical Deck Layout - Side Bin Vertical (CON_BIND) */}
      {layoutMode === 'vertical' && (
        <div className="vertical-banks-grid">
          {/* Side Bank 1: Slots 1 to 15 */}
          <div
            style={{
              background: '#040711',
              border: '1.5px solid #1a2234',
              borderRadius: '8px',
              padding: '4px 5px',
              boxShadow: 'inset 0 4px 14px rgba(0, 0, 0, 0.85)',
              display: 'flex',
              flexDirection: 'column',
              gap: '3px',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '3px 8px',
                background: '#090f1f',
                border: '1px solid #1e293b',
                borderRadius: '5px',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                marginBottom: '1px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#3b82f6', boxShadow: '0 0 5px #3b82f6' }} />
                <span style={{ fontSize: '10px', fontWeight: 800, color: '#e2e8f0', letterSpacing: '0.3px' }}>
                  VERTICAL BANK 1 • SLOTS 01 – 15
                </span>
              </div>
              <span style={{ fontSize: '9px', fontWeight: 700, color: '#94a3b8' }}>
                {bank1Occupied}/15 LOADED
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1 }}>
              {bank1Comps.map(renderVerticalPocket)}
            </div>
          </div>

          {/* Side Bank 2: Slots 16 to 30 */}
          <div
            style={{
              background: '#040711',
              border: '1.5px solid #1a2234',
              borderRadius: '8px',
              padding: '4px 5px',
              boxShadow: 'inset 0 4px 14px rgba(0, 0, 0, 0.85)',
              display: 'flex',
              flexDirection: 'column',
              gap: '3px',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '3px 8px',
                background: '#090f1f',
                border: '1px solid #1e293b',
                borderRadius: '5px',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                marginBottom: '1px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#8b5cf6', boxShadow: '0 0 5px #8b5cf6' }} />
                <span style={{ fontSize: '10px', fontWeight: 800, color: '#e2e8f0', letterSpacing: '0.3px' }}>
                  VERTICAL BANK 2 • SLOTS 16 – 30
                </span>
              </div>
              <span style={{ fontSize: '9px', fontWeight: 700, color: '#94a3b8' }}>
                {bank2Occupied}/15 LOADED
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1 }}>
              {bank2Comps.map(renderVerticalPocket)}
            </div>
          </div>
        </div>
      )}

      {/* Bottom Lip Molded Specification */}
      <div className="tote-bottom-lip">
        <span>SPEC: HIGH-IMPACT CONDUCTIVE POLYPROPYLENE (ESD SURFACE RESISTIVITY: 10^4 - 10^9 Ω)</span>
        <span>
          LAYOUT:{' '}
          {layoutMode === 'vertical'
            ? `2 VERTICAL BANKS × 15 SLOTS (${sortedCompartments.length} POCKET MATRIX) • PPS: ${binName || 'CON_BIND'}`
            : `2 ROWS × 15 SLOTS (${sortedCompartments.length} POCKET MATRIX) • PPS: ${binName || 'CON_BINC'}`}
        </span>
      </div>
    </div>
  );
};
