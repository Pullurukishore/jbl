'use client';

import React from 'react';
import { Compartment } from '@/types/hu';
import { Check, Plus, Lock, Cpu, Zap, Radio } from 'lucide-react';

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
  const sortedCompartments = [...compartments].sort(
    (a, b) => a.compartment_number - b.compartment_number
  );

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

  return (
    <div className="esd-tote-container">
      <style jsx>{`
        /* Molded ESD Industrial Tote Outer Casing */
        .esd-tote-container {
          background: linear-gradient(180deg, #111827 0%, #0b0f19 50%, #030712 100%);
          border: 3px solid #1f293d;
          border-radius: 14px;
          padding: 10px 12px;
          box-shadow: 0 12px 30px -8px rgba(0, 0, 0, 0.7),
                      inset 0 1px 1px rgba(255, 255, 255, 0.08),
                      inset 0 -2px 4px rgba(0, 0, 0, 0.9);
          position: relative;
          width: 100%;
          height: 100%;
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          user-select: none;
          overflow-x: auto;
          min-height: 520px;
        }

        /* Molded Outer Lip & Carry Grips */
        .tote-top-lip {
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: #080d1a;
          border: 1px solid #1e293b;
          border-radius: 8px;
          padding: 6px 12px;
          margin-bottom: 8px;
          box-shadow: inset 0 2px 5px rgba(0, 0, 0, 0.6);
          flex-shrink: 0;
        }

        .handle-grip-recess {
          width: 36px;
          height: 10px;
          background: #030712;
          border: 1px solid #334155;
          border-radius: 9999px;
          box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.9);
        }

        .tote-spec-label {
          display: flex;
          align-items: center;
          gap: 6px;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          font-size: 10.5px;
          font-weight: 700;
          color: #94a3b8;
          letter-spacing: 0.5px;
          text-transform: uppercase;
        }

        .esd-badge {
          display: inline-flex;
          align-items: center;
          gap: 3px;
          background: rgba(234, 179, 8, 0.15);
          color: #facc15;
          border: 1px solid rgba(234, 179, 8, 0.35);
          padding: 1px 5px;
          border-radius: 3px;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 0.5px;
        }

        .tote-telemetry {
          display: flex;
          align-items: center;
          gap: 10px;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          font-size: 10px;
          font-weight: 700;
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
          padding: 10px 8px;
          box-shadow: inset 0 6px 18px rgba(0, 0, 0, 0.85);
          display: grid;
          grid-template-columns: repeat(15, minmax(0, 1fr));
          grid-template-rows: repeat(2, minmax(160px, 1fr));
          column-gap: 6px;
          row-gap: 10px;
          width: 100%;
          min-width: 860px;
          flex: 1;
        }

        /* Individual Physical Socket Pocket */
        .socket-pocket {
          border-radius: 8px;
          height: 100%;
          min-height: 160px;
          padding: 8px 6px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          position: relative;
          transition: all 0.18s cubic-bezier(0.4, 0, 0.2, 1);
          overflow: hidden;
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

        /* PCB Gold Edge Contacts at top of card */
        .pcb-edge-contacts {
          display: flex;
          justify-content: center;
          gap: 2px;
          margin-bottom: 2px;
          opacity: 0.85;
        }

        .pcb-pin {
          width: 3.5px;
          height: 5px;
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
        }

        .slot-badge-occupied {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          font-size: 10px;
          font-weight: 800;
          color: #34d399;
          background: rgba(6, 78, 59, 0.7);
          border: 1px solid rgba(16, 185, 129, 0.4);
          padding: 2px 5px;
          border-radius: 4px;
          letter-spacing: 0.3px;
        }

        .status-led-green {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #34d399;
          box-shadow: 0 0 8px #34d399, 0 0 3px #10b981;
        }

        /* PCB Module Chip Center */
        .pcb-module-body {
          background: rgba(6, 78, 59, 0.35);
          border: 1px solid rgba(16, 185, 129, 0.3);
          border-radius: 6px;
          padding: 8px 4px;
          text-align: center;
          margin: 6px 0;
          position: relative;
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: center;
        }

        .pcb-module-body::before {
          content: '';
          position: absolute;
          top: 3px;
          left: 4px;
          width: 3px;
          height: 3px;
          border-radius: 50%;
          background: rgba(52, 211, 153, 0.4);
        }

        .serial-code-text {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          font-size: 10.5px;
          font-weight: 800;
          color: #ffffff;
          letter-spacing: 0;
          word-break: break-all;
          overflow-wrap: anywhere;
          line-height: 1.25;
          text-align: center;
          display: block;
        }

        .material-code-text {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          font-size: 9px;
          font-weight: 700;
          color: #fbbf24;
          margin-top: 5px;
          letter-spacing: 0;
          word-break: break-all;
          overflow-wrap: anywhere;
          line-height: 1.2;
          text-align: center;
          display: block;
        }

        /* PCB Lower Footer */
        .pocket-footer-occupied {
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-top: 1px solid rgba(6, 78, 59, 0.6);
          padding-top: 3px;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          font-size: 8px;
          color: #34d399;
          font-weight: 700;
          letter-spacing: 0.25px;
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
          font-size: 10px;
          font-weight: 800;
          color: #fbbf24;
          background: rgba(120, 53, 15, 0.7);
          border: 1px solid rgba(245, 158, 11, 0.4);
          padding: 2px 5px;
          border-radius: 4px;
          letter-spacing: 0.25px;
        }

        .status-led-amber {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #fbbf24;
          box-shadow: 0 0 8px #fbbf24, 0 0 3px #d97706;
        }

        .pcb-module-body-picked {
          background: rgba(120, 53, 15, 0.35);
          border: 1px solid rgba(245, 158, 11, 0.3);
          border-radius: 6px;
          padding: 8px 4px;
          text-align: center;
          margin: 6px 0;
          position: relative;
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: center;
        }

        .serial-code-text-picked {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          font-size: 10.5px;
          font-weight: 800;
          color: #ffffff;
          letter-spacing: 0;
          word-break: break-all;
          overflow-wrap: anywhere;
          line-height: 1.25;
          text-align: center;
          display: block;
        }

        .material-code-text-picked {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          font-size: 9px;
          font-weight: 700;
          color: #fbbf24;
          margin-top: 5px;
          letter-spacing: 0;
          word-break: break-all;
          overflow-wrap: anywhere;
          line-height: 1.2;
          text-align: center;
          display: block;
        }

        .pocket-footer-picked {
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-top: 1px solid rgba(120, 53, 15, 0.6);
          padding-top: 3px;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          font-size: 8px;
          color: #fbbf24;
          font-weight: 700;
          letter-spacing: 0.25px;
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
          font-size: 10px;
          font-weight: 800;
          color: #93c5fd;
          background: rgba(30, 58, 138, 0.7);
          border: 1px solid rgba(59, 130, 246, 0.5);
          padding: 2px 5px;
          border-radius: 4px;
        }

        .target-indicator-text {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          font-size: 8.5px;
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
          padding: 6px 0;
          gap: 4px;
          flex: 1;
        }

        .scan-icon-circle {
          width: 32px;
          height: 32px;
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
          font-size: 10px;
          font-weight: 700;
          color: #bfdbfe;
        }

        .pocket-footer-target {
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-top: 1px solid rgba(30, 58, 138, 0.6);
          padding-top: 3px;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          font-size: 8px;
          color: #60a5fa;
          font-weight: 700;
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
          font-size: 10px;
          font-weight: 700;
          color: #64748b;
          background: #0f172a;
          border: 1px solid #1e293b;
          padding: 2px 5px;
          border-radius: 4px;
        }

        .empty-slot-guide {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 6px 0;
          gap: 4px;
          flex: 1;
        }

        .guide-crosshair {
          color: #334155;
          font-size: 18px;
          transition: all 0.2s ease;
        }

        .socket-pocket.empty-standard:hover .guide-crosshair {
          color: #94a3b8;
          transform: scale(1.1);
        }

        .empty-slot-text {
          font-size: 10px;
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
          border-top: 1px solid #111827;
          padding-top: 3px;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          font-size: 8px;
          color: #475569;
          font-weight: 600;
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
          font-size: 9.5px;
          color: #64748b;
          flex-shrink: 0;
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

      {/* Sunken Socket Pocket Deck */}
      <div className="socket-deck">
        {sortedCompartments.map((comp) => {
          const isPicked = isSlotPicked(comp);
          const isOccupied = isSlotOccupied(comp);
          const isSelected = selectedCompartment === comp.compartment_number;
          const isNextTarget = !isOccupied && !isPicked && comp.compartment_number === nextTargetComp;
          const isClickable = !isOccupied && !isPicked && !disabled && !!onSelectEmpty;

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
              style={{ cursor: isClickable || isOccupiedClickable || isPickedClickable ? 'pointer' : 'default' }}
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
                  <div>
                    <div className="pcb-edge-contacts" style={{ opacity: 0.5 }}>
                      <div className="pcb-pin" style={{ background: '#94a3b8' }} />
                      <div className="pcb-pin" style={{ background: '#94a3b8' }} />
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

                    <div
                      className="pcb-module-body-picked"
                      title={`Picked Serial: ${comp.serial_number || comp.put?.serial_number || 'N/A'}\nModel: ${comp.material_name || comp.put?.model_number || 'N/A'}`}
                    >
                      <div className="serial-code-text-picked">
                        ✓ {comp.serial_number || comp.put?.serial_number || 'PICKED PART'}
                      </div>
                      {(comp.material_name || comp.put?.model_number) && (
                        <div className="material-code-text-picked">
                          {comp.material_name || comp.put?.model_number}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pocket-footer-picked">
                    <span>PICKED</span>
                    <span>KANBAN-OUT ✓</span>
                  </div>
                </>
              )}

              {/* === OCCUPIED: SEATED PCB ADAPTER CARD (PUT) === */}
              {isOccupied && (
                <>
                  <div>
                    {/* Simulated Gold PCB Pin Contacts */}
                    <div className="pcb-edge-contacts">
                      <div className="pcb-pin" />
                      <div className="pcb-pin" />
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

                    <div
                      className="pcb-module-body"
                      title={`Serial: ${comp.serial_number || 'N/A'}\nModel: ${comp.material_name || 'N/A'}`}
                    >
                      <div className="serial-code-text">
                        {comp.serial_number || 'SEATED PART'}
                      </div>
                      {comp.material_name && (
                        <div className="material-code-text">
                          {comp.material_name}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pocket-footer-occupied">
                    <span>STORED</span>
                    <span>PASS • VERIFIED</span>
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
                    <span>ACTIVE</span>
                    <span>READY</span>
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
                    <span>EMPTY</span>
                    <span>READY</span>
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
                    <span>SLOT OPEN</span>
                    <span>EMPTY</span>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Bottom Lip Molded Specification */}
      <div className="tote-bottom-lip">
        <span>SPEC: HIGH-IMPACT CONDUCTIVE POLYPROPYLENE (ESD SURFACE RESISTIVITY: 10^4 - 10^9 Ω)</span>
        <span>LAYOUT: 2 ROWS × 15 SLOTS ({sortedCompartments.length} POCKET MATRIX)</span>
      </div>
    </div>
  );
};
