'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { TimelineProgress } from '@/components/shared/TimelineProgress';
import { connectSSE, apiPost, apiDownloadFile, downloadBlob } from '@/lib/api';
import { Log } from '@/types';
import {
  PackageMinus,
  Search,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  Minus,
  Plus,
  Boxes,
  Barcode,
  Download,
  Loader2,
  Clock,
  ArrowRight,
  ShieldCheck,
  MapPin,
  Check,
  Zap,
  ListChecks,
  CheckSquare,
  Square,
  Layers,
  CheckCheck,
  Table as TableIcon,
  LayoutGrid,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface AvailableInventoryItem {
  id: number;
  serial_number: string;
  model_number: string;
  birth_date?: string | null;
  compartment?: {
    compartment_number?: number | null;
  } | null;
  handling_unit?: {
    hu_id?: string | null;
  } | null;
}

interface PickPlanItem {
  id: number;
  serial_number: string;
  model_number: string;
  compartment_number: number | null;
  compartment_id?: number | null;
  birth_date?: string | null;
}

interface PickPlanBin {
  hu_id: string;
  handling_unit_id: number | null;
  storage_status?: string;
  qty: number;
  serials: string[];
  compartments: number[];
  items: PickPlanItem[];
}

interface PickPlanResponse {
  resolvedModelNumber: string;
  requestedQuantity: number;
  totalAvailable: number;
  allocatedQuantity: number;
  bins: PickPlanBin[];
  totalBins: number;
  message?: string;
}

interface PickedBinRecord {
  fileName: string;
  pickId: number;
  lineCount: number;
  pickedSerials: string[];
  pickedAt: string;
}

const PICK_STEPS = [
  { key: 'FETCH_DETAILS', label: '1. Verify Stock & MES Status' },
  { key: 'CHECK_QTY', label: '2. Verify Required Quantity' },
  { key: 'CHECK_STATUS', label: '3. Update MES Kanban History' },
  { key: 'FILE_GENERATED', label: '4. Generate Pick Order Text File' },
];

export default function PickWorkstationPage() {
  const router = useRouter();
  const { canPick, isLoading: authLoading } = useAuth();

  // Mode Selection: 'quick' (Auto FIFO by Quantity) vs 'select' (Select Specific Serials)
  const [pickMode, setPickMode] = useState<'quick' | 'select'>('quick');

  // ==========================================
  // MODE 1: Auto FIFO Pick by Quantity & Bin Allocation
  // ==========================================
  const [barcodeInput, setBarcodeInput] = useState('');
  const [detectedModel, setDetectedModel] = useState<string | null>(null);
  const [availableStock, setAvailableStock] = useState<number | null>(null);
  const [isCheckingStock, setIsCheckingStock] = useState(false);
  const [quantity, setQuantity] = useState<number>(1);

  // Mode 1 Bin-Wise Allocation & Scanning State
  const [pickPlan, setPickPlan] = useState<PickPlanResponse | null>(null);
  const [isLoadingPlan, setIsLoadingPlan] = useState(false);
  const [pickedBins, setPickedBins] = useState<Record<string, PickedBinRecord>>({});
  const pickedBinsRef = useRef<Record<string, PickedBinRecord>>({});
  const [activeBinHuId, setActiveBinHuId] = useState<string | null>(null);
  const [isPickingBin, setIsPickingBin] = useState<string | null>(null);
  const [isSessionFinished, setIsSessionFinished] = useState(false);
  const [selectedBinHuIds, setSelectedBinHuIds] = useState<string[]>([]);
  const [completedBinFiles, setCompletedBinFiles] = useState<
    { fileName: string; pickId: number; lineCount: number; huId: string }[]
  >([]);

  // 40+ Bins Scalability Controls
  const [binViewMode, setBinViewMode] = useState<'table' | 'cards'>('table');
  const [binSearchQuery, setBinSearchQuery] = useState('');
  const [expandedBinHuIds, setExpandedBinHuIds] = useState<string[]>([]);

  // ==========================================
  // MODE 2: Select Specific Serials from Inventory
  // ==========================================
  const [selectModelInput, setSelectModelInput] = useState('');
  const [resolvedSelectModel, setResolvedSelectModel] = useState<string | null>(null);
  const [selectTargetQty, setSelectTargetQty] = useState<number>(1);
  const [isLoadingInventory, setIsLoadingInventory] = useState(false);
  const [inventoryList, setInventoryList] = useState<AvailableInventoryItem[]>([]);
  const [selectedSerialNumbers, setSelectedSerialNumbers] = useState<string[]>([]);
  const [inventorySearch, setInventorySearch] = useState('');

  // Universal Feedback & Error
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  // SSE & Execution State
  const [logs, setLogs] = useState<Log[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [completedInfo, setCompletedInfo] = useState<{
    fileName?: string;
    pickId?: number;
    lineCount?: number;
    label?: string;
  } | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  // Refs
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const selectModelInputRef = useRef<HTMLInputElement>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const autoCheckTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!authLoading && !canPick) {
      router.replace('/error/403');
    }
  }, [authLoading, canPick, router]);

  useEffect(() => {
    if (pickMode === 'quick') {
      setTimeout(() => barcodeInputRef.current?.focus(), 100);
    } else {
      setTimeout(() => selectModelInputRef.current?.focus(), 100);
    }
  }, [pickMode]);

  useEffect(() => {
    if ((isProcessing || logs.length > 0) && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [isProcessing, logs]);

  const handleResetAll = () => {
    setBarcodeInput('');
    setDetectedModel(null);
    setAvailableStock(null);
    setIsCheckingStock(false);
    setQuantity(1);

    setPickPlan(null);
    setIsLoadingPlan(false);
    pickedBinsRef.current = {};
    setPickedBins({});
    setActiveBinHuId(null);
    setSelectedBinHuIds([]);
    setIsPickingBin(null);
    setIsSessionFinished(false);
    setCompletedBinFiles([]);
    setBinSearchQuery('');
    setExpandedBinHuIds([]);

    setSelectModelInput('');
    setResolvedSelectModel(null);
    setSelectTargetQty(1);
    setInventoryList([]);
    setSelectedSerialNumbers([]);
    setInventorySearch('');

    setFeedback(null);
    setErrorMsg('');
    setLogs([]);
    setIsProcessing(false);
    setIsCompleted(false);
    setCompletedInfo(null);
    setIsDownloading(false);

    if (pickMode === 'quick') {
      setTimeout(() => barcodeInputRef.current?.focus(), 50);
    } else {
      setTimeout(() => selectModelInputRef.current?.focus(), 50);
    }
  };

  // -------------------------------------------------------------
  // Mode 1: Automatic Background Stock Detection & Bin Allocation
  // -------------------------------------------------------------
  const fetchPickPlanInBackground = useCallback(async (raw: string, qty: number) => {
    const clean = raw.trim();
    if (!clean || clean.length < 2) {
      setDetectedModel(null);
      setAvailableStock(null);
      setPickPlan(null);
      setActiveBinHuId(null);
      return;
    }

    try {
      setIsCheckingStock(true);
      setIsLoadingPlan(true);

      // Call reliable native endpoint that returns available stock and FIFO inventory rows
      const res = await apiPost<{
        resolvedModelNumber?: string;
        totalItems?: number;
        availableCount?: number;
        data?: any[];
      }>('/put/find-by-model-and-qty', {
        partNumber: clean,
        quantity: qty,
        page: 1,
        size: 50,
      });

      const totalItems = res?.totalItems ?? res?.availableCount ?? 0;
      const modelNum = res?.resolvedModelNumber || clean;
      setDetectedModel(modelNum);
      setAvailableStock(totalItems);

      if (totalItems > 0 && Array.isArray(res.data) && res.data.length > 0) {
        // Take the top `qty` FIFO candidates
        const candidates = res.data.slice(0, Math.max(1, qty));
        const binMap = new Map<string, PickPlanBin>();

        candidates.forEach((item: any) => {
          const huId =
            item.handling_unit?.hu_id ||
            (item.handling_unit_id ? `HU-${item.handling_unit_id}` : 'Standalone');

          if (!binMap.has(huId)) {
            binMap.set(huId, {
              hu_id: huId,
              handling_unit_id: item.handling_unit_id || null,
              storage_status: item.handling_unit?.storage_status || 'IN_KARDEX',
              qty: 0,
              serials: [],
              compartments: [],
              items: [],
            });
          }

          const binEntry = binMap.get(huId)!;
          binEntry.qty += 1;
          binEntry.serials.push(item.serial_number);
          const compNum = item.compartment?.compartment_number || null;
          if (compNum) binEntry.compartments.push(compNum);

          binEntry.items.push({
            id: item.id,
            serial_number: item.serial_number,
            model_number: item.model_number || modelNum,
            compartment_number: compNum,
            compartment_id: item.compartment_id || null,
            birth_date: item.birth_date,
          });
        });

        const planBins = Array.from(binMap.values());
        const plan: PickPlanResponse = {
          resolvedModelNumber: modelNum,
          requestedQuantity: qty,
          totalAvailable: totalItems,
          allocatedQuantity: candidates.length,
          bins: planBins,
          totalBins: planBins.length,
        };

        setPickPlan(plan);
        pickedBinsRef.current = {};
        setPickedBins({});
        setIsSessionFinished(false);
        setSelectedBinHuIds([]);
        if (planBins.length > 4) {
          setBinViewMode('table');
        }
        setActiveBinHuId((prev) => {
          if (prev && planBins.some((b) => b.hu_id === prev)) return prev;
          return planBins[0]?.hu_id || null;
        });
      } else {
        setPickPlan(null);
        setSelectedBinHuIds([]);
        setActiveBinHuId(null);
      }
    } catch (err) {
      console.error('Error fetching stock plan:', err);
      setAvailableStock(0);
      setPickPlan(null);
      setSelectedBinHuIds([]);
      setActiveBinHuId(null);
    } finally {
      setIsCheckingStock(false);
      setIsLoadingPlan(false);
    }
  }, []);

  const toggleBinExpand = (huId: string) => {
    setExpandedBinHuIds((prev) =>
      prev.includes(huId) ? prev.filter((id) => id !== huId) : [...prev, huId]
    );
  };

  const filteredPlanBins = useMemo(() => {
    if (!pickPlan) return [];
    if (!binSearchQuery.trim()) return pickPlan.bins;
    const q = binSearchQuery.toLowerCase();
    return pickPlan.bins.filter(
      (b) =>
        b.hu_id.toLowerCase().includes(q) ||
        b.serials.some((s) => s.toLowerCase().includes(q)) ||
        b.compartments.some((c) => String(c).includes(q))
    );
  }, [pickPlan, binSearchQuery]);

  const handleBarcodeInput = (val: string) => {
    setBarcodeInput(val);
    pickedBinsRef.current = {};
    setPickedBins({});
    setCompletedBinFiles([]);
    setIsSessionFinished(false);
    setIsCompleted(false);
    setFeedback(null);
    setErrorMsg('');
    if (autoCheckTimeoutRef.current) clearTimeout(autoCheckTimeoutRef.current);
    autoCheckTimeoutRef.current = setTimeout(() => {
      fetchPickPlanInBackground(val, quantity);
    }, 350);
  };

  const handleQuantityChange = (newQty: number) => {
    const validQty = Math.max(1, newQty);
    setQuantity(validQty);
    pickedBinsRef.current = {};
    setPickedBins({});
    setCompletedBinFiles([]);
    setIsSessionFinished(false);
    setIsCompleted(false);
    if (barcodeInput.trim()) {
      if (autoCheckTimeoutRef.current) clearTimeout(autoCheckTimeoutRef.current);
      autoCheckTimeoutRef.current = setTimeout(() => {
        fetchPickPlanInBackground(barcodeInput, validQty);
      }, 250);
    }
  };

  // Mode 1: Execute Pick for a Specific Bin via SSE
  const executeBinPick = (bin: PickPlanBin) => {
    if (isProcessing) return;
    const rawModel = detectedModel || barcodeInput.trim();
    if (!rawModel) return;

    setLogs([]);
    setIsProcessing(true);
    setIsPickingBin(bin.hu_id);
    setErrorMsg('');
    setFeedback(null);

    const serialsParam = bin.serials.join(',');
    const endpoint = `/pick/create/${encodeURIComponent(rawModel)}/${bin.qty}?serials=${encodeURIComponent(serialsParam)}`;

    connectSSE(
      endpoint,
      (data: any) => {
        if (data && typeof data === 'object') {
          setLogs((prev) => {
            const index = prev.findIndex((l) => l.activity === data.activity);
            if (index >= 0) {
              const updated = [...prev];
              updated[index] = data;
              return updated;
            }
            return [...prev, data];
          });

          if (data.status === 'FAILED') {
            setErrorMsg(data.message || `Pick failed for Bin ${bin.hu_id}.`);
            setIsProcessing(false);
            setIsPickingBin(null);
          }

          if (data.activity === 'FILE_GENERATED' && data.status === 'SUCCESS') {
            setIsProcessing(false);
            setIsPickingBin(null);

            const result: PickedBinRecord = {
              fileName: data.fileName,
              pickId: data.pick_id,
              lineCount: data.lineCount || bin.qty,
              pickedSerials: data.picked_serials || bin.serials,
              pickedAt: new Date().toLocaleTimeString(),
            };

            const nextPickedBins = {
              ...pickedBinsRef.current,
              [bin.hu_id]: result,
            };
            pickedBinsRef.current = nextPickedBins;
            setPickedBins(nextPickedBins);

            const newFile = {
              fileName: data.fileName,
              pickId: data.pick_id,
              lineCount: data.lineCount || bin.qty,
              huId: bin.hu_id,
            };
            setCompletedBinFiles((prev) => [...prev, newFile]);

            setFeedback({
              type: 'success',
              message: `Bin ${bin.hu_id} successfully picked (${bin.qty} units). MES Kanban-Out completed.`,
            });

            // Find next unpicked bin
            if (pickPlan) {
              const remainingBins = pickPlan.bins.filter((b) => !nextPickedBins[b.hu_id]);
              setSelectedBinHuIds([]);
              if (remainingBins.length === 0) {
                setIsCompleted(true);
                setIsSessionFinished(true);
              } else {
                setActiveBinHuId(remainingBins[0].hu_id);
                setIsSessionFinished(false);
                setIsCompleted(false);
              }
            }
          }
        }
      },
      () => {
        setIsProcessing(false);
        setIsPickingBin(null);
      },
      () => {
        setIsProcessing(false);
        setIsPickingBin(null);
      }
    );
  };

  // Mode 1: Checkbox selection handlers for bins
  const handleToggleBinSelect = (huId: string) => {
    if (pickedBinsRef.current[huId] || isProcessing) return;
    setIsSessionFinished(false);
    setSelectedBinHuIds((prev) =>
      prev.includes(huId) ? prev.filter((id) => id !== huId) : [...prev, huId]
    );
  };

  const handleSelectAllBins = () => {
    if (!pickPlan || isProcessing) return;
    setIsSessionFinished(false);
    const unpicked = pickPlan.bins.filter((b) => !pickedBinsRef.current[b.hu_id]).map((b) => b.hu_id);
    setSelectedBinHuIds(unpicked);
  };

  const handleDeselectAllBins = () => {
    if (isProcessing) return;
    setSelectedBinHuIds([]);
  };

  // Mode 1: Batch Pick Selected Bins
  const executeSelectedBinsPick = () => {
    if (isProcessing || !pickPlan) return;
    const currentPicked = pickedBinsRef.current;
    const unpickedSelected = pickPlan.bins.filter(
      (b) => selectedBinHuIds.includes(b.hu_id) && !currentPicked[b.hu_id]
    );
    if (unpickedSelected.length === 0) {
      setErrorMsg('Please select at least one unpicked bin.');
      return;
    }

    const rawModel = detectedModel || barcodeInput.trim();
    if (!rawModel) return;

    const allSerials = unpickedSelected.flatMap((b) => b.serials);
    const totalCount = allSerials.length;
    const serialsQuery = allSerials.join(',');
    const binNames = unpickedSelected.map((b) => b.hu_id).join(', ');

    const endpoint = `/pick/create/${encodeURIComponent(rawModel)}/${totalCount}?serials=${encodeURIComponent(serialsQuery)}`;

    executeSSEPick(
      endpoint,
      totalCount,
      `${totalCount} units from ${unpickedSelected.length} bins (${binNames})`,
      unpickedSelected.map((b) => b.hu_id)
    );
  };

  // Mode 1: Finish Session Early ("Take Half Only")
  const handleFinishEarly = () => {
    const totalUnitsPicked = Object.values(pickedBins).reduce((sum, b) => sum + b.lineCount, 0);
    if (totalUnitsPicked === 0) {
      handleResetAll();
      return;
    }
    setIsSessionFinished(true);
    setIsCompleted(true);
    setFeedback({
      type: 'success',
      message: `Pick session completed early: ${totalUnitsPicked} units picked from Kardex. Unpicked units are untouched in stock with zero false Kanban-Out in MES.`,
    });
  };

  // Download individual file by pick id
  const handleDownloadFileById = async (pickId: number) => {
    try {
      setIsDownloading(true);
      const { blob, fileName } = await apiDownloadFile('/pick/download-text-file', {
        id: pickId,
      });
      downloadBlob(blob, fileName);
    } catch (err: any) {
      alert(err.message || 'Error downloading pick file');
    } finally {
      setIsDownloading(false);
    }
  };

  // Mode 1: Direct Execute Auto-Pick (FIFO all at once)
  const handleExecuteQuickPick = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const raw = barcodeInput.trim();
    if (!raw || isProcessing) return;

    if (quantity <= 0) {
      setErrorMsg('Please enter a valid quantity to pick.');
      return;
    }

    const endpoint = `/pick/create/${encodeURIComponent(raw)}/${quantity}`;
    executeSSEPick(
      endpoint,
      quantity,
      `${quantity} units of ${detectedModel || raw}`
    );
  };

  // -------------------------------------------------------------
  // Mode 2: Auto-Load Inventory Checklist (No "Load Stock" button)
  // -------------------------------------------------------------
  const loadInventoryAuto = useCallback(async (raw: string) => {
    const clean = raw.trim();
    if (!clean || clean.length < 2) {
      setInventoryList([]);
      setResolvedSelectModel(null);
      setSelectedSerialNumbers([]);
      return;
    }

    try {
      setIsLoadingInventory(true);
      setErrorMsg('');
      setFeedback(null);

      const res = await apiPost<any>('/put/find-by-model-and-qty', {
        partNumber: clean,
        quantity: 0,
        page: 1,
        size: 1000,
      });

      const model = res?.resolvedModelNumber || clean;
      setResolvedSelectModel(model);

      if (res?.data && res.data.length > 0) {
        setInventoryList(res.data);
        setSelectTargetQty((prev) => Math.min(Math.max(1, prev), res.data.length));
      } else {
        setInventoryList([]);
        setSelectTargetQty(1);
      }
    } catch {
      setInventoryList([]);
    } finally {
      setIsLoadingInventory(false);
    }
  }, []);

  const handleSelectModelInputChange = (val: string) => {
    setSelectModelInput(val);
    if (autoCheckTimeoutRef.current) clearTimeout(autoCheckTimeoutRef.current);
    autoCheckTimeoutRef.current = setTimeout(() => {
      loadInventoryAuto(val);
    }, 400);
  };

  const handleToggleSelectSerial = (serial: string) => {
    setSelectedSerialNumbers((prev) =>
      prev.includes(serial) ? prev.filter((s) => s !== serial) : [...prev, serial]
    );
  };

  const handleSelectFirstN = () => {
    const filtered = filteredInventory;
    const toSelect = filtered.slice(0, selectTargetQty).map((item) => item.serial_number);
    setSelectedSerialNumbers(toSelect);
  };

  const handleDeselectAll = () => {
    setSelectedSerialNumbers([]);
  };

  const filteredInventory = inventoryList.filter((item) => {
    if (!inventorySearch.trim()) return true;
    const query = inventorySearch.toLowerCase();
    return (
      item.serial_number.toLowerCase().includes(query) ||
      (item.handling_unit?.hu_id && item.handling_unit.hu_id.toLowerCase().includes(query)) ||
      (item.compartment?.compartment_number && String(item.compartment.compartment_number).includes(query))
    );
  });

  // Mode 2: Direct Execute Selected Serials Pick
  const handleExecuteSelectedPick = () => {
    if (!resolvedSelectModel || selectedSerialNumbers.length === 0 || isProcessing) return;

    const count = selectedSerialNumbers.length;
    const serialList = selectedSerialNumbers.join(',');
    const endpoint = `/pick/create/${encodeURIComponent(resolvedSelectModel)}/${count}?serials=${encodeURIComponent(serialList)}`;

    executeSSEPick(
      endpoint,
      count,
      `${count} selected serials (${resolvedSelectModel})`
    );
  };

  // -------------------------------------------------------------
  // Universal SSE Execution & File Generation
  // -------------------------------------------------------------
  const executeSSEPick = (
    endpoint: string,
    expectedLineCount: number,
    label: string,
    targetBinHuIds?: string[]
  ) => {
    setLogs([]);
    setIsProcessing(true);
    setIsCompleted(false);
    setCompletedInfo(null);
    setErrorMsg('');

    connectSSE(
      endpoint,
      (data: any) => {
        if (data && typeof data === 'object') {
          setLogs((prev) => {
            const index = prev.findIndex((l) => l.activity === data.activity);
            if (index >= 0) {
              const updated = [...prev];
              updated[index] = data;
              return updated;
            }
            return [...prev, data];
          });

          if (data.status === 'FAILED') {
            setErrorMsg(data.message || 'Pick process failed.');
            setIsProcessing(false);
          }

          if (data.activity === 'FILE_GENERATED' && data.status === 'SUCCESS') {
            setIsProcessing(false);
            const lineCount = data.lineCount || expectedLineCount;
            setCompletedInfo({
              fileName: data.fileName,
              pickId: data.pick_id,
              lineCount: lineCount,
              label: label,
            });

            // If a pick plan is active and bins were selected for pick
            const targeted =
              targetBinHuIds && targetBinHuIds.length > 0
                ? targetBinHuIds
                : selectedBinHuIds;

            if (pickPlan && targeted.length > 0) {
              const affectedBins = pickPlan.bins.filter((b) => targeted.includes(b.hu_id));
              const currentPicked = pickedBinsRef.current;
              const updatedBinsMap: Record<string, PickedBinRecord> = { ...currentPicked };
              for (const bin of affectedBins) {
                updatedBinsMap[bin.hu_id] = {
                  fileName: data.fileName,
                  pickId: data.pick_id,
                  lineCount: bin.qty,
                  pickedSerials: bin.serials,
                  pickedAt: new Date().toLocaleTimeString(),
                };
              }
              pickedBinsRef.current = updatedBinsMap;
              setPickedBins(updatedBinsMap);

              setCompletedBinFiles((prev) => [
                ...prev,
                {
                  fileName: data.fileName,
                  pickId: data.pick_id,
                  lineCount: lineCount,
                  huId: affectedBins.map((b) => b.hu_id).join(', '),
                },
              ]);

              const remaining = pickPlan.bins.filter((b) => !updatedBinsMap[b.hu_id]);
              const isAllDone = remaining.length === 0;
              setIsSessionFinished(isAllDone);
              setIsCompleted(isAllDone);
              setSelectedBinHuIds([]);
              if (!isAllDone) {
                setActiveBinHuId(remaining[0].hu_id);
              }
            } else {
              setIsCompleted(true);
              setIsSessionFinished(true);
            }
          }
        }
      },
      () => setIsProcessing(false),
      () => setIsProcessing(false)
    );
  };

  const handleDownloadFile = async () => {
    if (!completedInfo?.pickId) return;
    try {
      setIsDownloading(true);
      const { blob, fileName } = await apiDownloadFile('/pick/download-text-file', {
        id: completedInfo.pickId,
      });
      downloadBlob(blob, fileName);
    } catch (err: any) {
      alert(err.message || 'Error downloading pick file');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="pick-page-layout">
      <style jsx>{`
        .pick-page-layout {
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
          min-height: calc(100vh - 90px);
        }

        .workstation-header {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 14px 20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
        }

        .header-left {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .header-icon {
          width: 42px;
          height: 42px;
          border-radius: 10px;
          background: rgba(245, 158, 11, 0.14);
          color: #d97706;
          border: 1px solid rgba(245, 158, 11, 0.3);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .header-title {
          font-size: 18px;
          font-weight: 800;
          color: #0f172a;
          margin: 0;
        }

        .header-sub {
          font-size: 12.5px;
          color: #64748b;
          margin-top: 2px;
        }

        /* Two-Column Split: Main workspace gets maximum width, Live MES monitor stays compact */
        .workstation-split {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 430px;
          gap: 1.25rem;
          align-items: flex-start;
        }

        @media (max-width: 1280px) {
          .workstation-split {
            grid-template-columns: minmax(0, 1fr) 390px;
          }
        }

        @media (max-width: 1024px) {
          .workstation-split {
            grid-template-columns: 1fr;
          }
          .panel-card.monitor-panel {
            position: static !important;
          }
        }

        @media (max-width: 640px) {
          .workstation-header {
            padding: 10px 14px;
            flex-direction: column;
            align-items: flex-start;
            gap: 8px;
          }
          .panel-card {
            padding: 1rem 0.85rem !important;
          }
        }

        .panel-card {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 1.25rem;
          display: flex;
          flex-direction: column;
          gap: 1.15rem;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
        }

        .panel-card.monitor-panel {
          position: sticky;
          top: 1rem;
        }

        /* 2-Segment Mode Toggle */
        .mode-toggle-bar {
          display: grid;
          grid-template-columns: 1fr 1fr;
          background: #f1f5f9;
          padding: 4px;
          border-radius: 10px;
          gap: 4px;
        }

        .mode-tab-btn {
          border: none;
          background: transparent;
          padding: 9px 12px;
          border-radius: 7px;
          font-size: 13px;
          font-weight: 700;
          color: #64748b;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          transition: all 0.15s ease;
        }

        .mode-tab-btn.active {
          background: #ffffff;
          color: #0f172a;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
        }

        .field-label {
          display: block;
          font-size: 12px;
          font-weight: 600;
          color: #475569;
          margin-bottom: 5px;
        }

        .field-input-box {
          position: relative;
          display: flex;
          align-items: center;
        }

        .field-input {
          width: 100%;
          height: 44px;
          border: 1.5px solid #e2e8f0;
          border-radius: 8px;
          padding: 0 12px 0 38px;
          font-size: 14.5px;
          font-weight: 600;
          color: #0f172a;
          outline: none;
          transition: all 0.2s ease;
        }

        .field-input:focus {
          border-color: #d97706;
          box-shadow: 0 0 0 3px rgba(217, 119, 6, 0.15);
        }

        .field-icon {
          position: absolute;
          left: 12px;
          color: #94a3b8;
        }

        /* Stepper */
        .stepper-box {
          display: flex;
          align-items: center;
          border: 1.5px solid #e2e8f0;
          border-radius: 8px;
          height: 42px;
          overflow: hidden;
          background: #ffffff;
        }

        .stepper-btn {
          width: 40px;
          height: 100%;
          background: #f8fafc;
          border: none;
          color: #64748b;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }

        .stepper-btn:hover:not(:disabled) {
          background: #e2e8f0;
          color: #0f172a;
        }

        .stepper-input {
          flex: 1;
          width: 100%;
          border: none;
          text-align: center;
          font-size: 16px;
          font-weight: 800;
          color: #0f172a;
          outline: none;
        }

        .preset-chip {
          padding: 4px 9px;
          border-radius: 6px;
          border: 1px solid #e2e8f0;
          background: #f8fafc;
          font-size: 11.5px;
          font-weight: 700;
          color: #475569;
          cursor: pointer;
        }

        .preset-chip:hover {
          background: #e2e8f0;
        }

        .preset-chip.selected {
          background: #d97706;
          color: #ffffff;
          border-color: #d97706;
        }

        .inventory-table-container {
          max-height: 280px;
          overflow-y: auto;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          background: #ffffff;
        }

        .inventory-row {
          display: flex;
          align-items: center;
          padding: 8px 12px;
          border-bottom: 1px solid #f1f5f9;
          gap: 10px;
          font-size: 12.5px;
          cursor: pointer;
          transition: background 0.1s ease;
        }

        .inventory-row:hover {
          background: #f8fafc;
        }

        .inventory-row.selected {
          background: #fffbeb;
          border-left: 3px solid #d97706;
        }

        /* Primary Pick Button */
        .btn-pick-execute {
          background: linear-gradient(135deg, #d97706 0%, #b45309 100%);
          color: #ffffff;
          border: none;
          height: 48px;
          border-radius: 9px;
          font-size: 15px;
          font-weight: 700;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          width: 100%;
          box-shadow: 0 2px 6px rgba(217, 119, 6, 0.25);
          transition: all 0.2s ease;
        }

        .btn-pick-execute:hover:not(:disabled) {
          background: linear-gradient(135deg, #b45309 0%, #92400e 100%);
          box-shadow: 0 4px 12px rgba(217, 119, 6, 0.35);
          transform: translateY(-1px);
        }

        .btn-pick-execute:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        /* Bin Plan & Bin Breakdown Cards */
        .bin-plan-container {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 12px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .bin-card {
          background: #ffffff;
          border: 1.5px solid #e2e8f0;
          border-radius: 9px;
          padding: 11px 13px;
          display: flex;
          flex-direction: column;
          gap: 6px;
          transition: all 0.15s ease;
        }

        .bin-card.active {
          border-color: #d97706;
          background: #fffdf7;
          box-shadow: 0 0 0 3px rgba(217, 119, 6, 0.12);
        }

        .bin-card.completed {
          border-color: #86efac;
          background: #f0fdf4;
        }

        .serial-chips-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-top: 5px;
        }

        .serial-chip {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: #f1f5f9;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          padding: 3px 8px;
          font-size: 11px;
        }

        .serial-slot-tag {
          background: #0f172a;
          color: #ffffff;
          padding: 1px 5px;
          border-radius: 4px;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.2px;
        }

        .serial-num-text {
          font-family: monospace;
          font-weight: 700;
          color: #0f172a;
        }

        /* 40+ Bins Scalable Table & Scroll Containers */
        .bin-table-wrapper {
          max-height: 420px;
          overflow-y: auto;
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
          border: 1px solid #e2e8f0;
          border-radius: 9px;
          background: #ffffff;
        }

        .bin-scroll-cards-wrapper {
          max-height: 440px;
          overflow-y: auto;
          padding-right: 4px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .bin-dense-table {
          width: 100%;
          min-width: 560px;
          border-collapse: collapse;
          font-size: 12px;
        }

        .bin-dense-table thead th {
          position: sticky;
          top: 0;
          background: #f8fafc;
          border-bottom: 1.5px solid #e2e8f0;
          padding: 8px 10px;
          font-weight: 700;
          color: #475569;
          font-size: 11px;
          z-index: 2;
        }

        .bin-dense-table tbody tr {
          border-bottom: 1px solid #f1f5f9;
          transition: background 0.12s ease;
        }

        .bin-dense-table tbody tr:hover {
          background: #f8fafc;
        }

        .bin-dense-table tbody tr.active-row {
          background: #fffdf5;
        }

        .bin-dense-table tbody tr.completed-row {
          background: #f0fdf4;
        }

        .bin-dense-table td {
          padding: 7px 10px;
          vertical-align: middle;
        }

        .view-mode-pill {
          border: 1px solid #e2e8f0;
          background: #ffffff;
          padding: 3px 8px;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 600;
          color: #64748b;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          transition: all 0.15s ease;
        }

        .view-mode-pill.active {
          background: #0f172a;
          color: #ffffff;
          border-color: #0f172a;
        }

        .bin-scan-box {
          background: #fffbeb;
          border: 1.5px solid #fde68a;
          border-radius: 9px;
          padding: 12px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .btn-pick-bin {
          background: #d97706;
          color: #ffffff;
          border: none;
          padding: 6px 14px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 5px;
          transition: background 0.15s ease;
        }

        .btn-pick-bin:hover:not(:disabled) {
          background: #b45309;
        }

        .btn-pick-bin:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .btn-finish-early {
          background: #ffffff;
          border: 1.5px solid #f59e0b;
          color: #b45309;
          padding: 8px 14px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          transition: all 0.15s ease;
        }

        .btn-finish-early:hover:not(:disabled) {
          background: #fffbeb;
          border-color: #d97706;
          color: #92400e;
        }

        /* Right Monitor Section */
        .success-banner {
          background: #f0fdf4;
          border: 1px solid #bbf7d0;
          border-radius: 10px;
          padding: 1rem 1.2rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          flex-wrap: wrap;
        }

        .success-btn {
          background: #16a34a;
          color: #ffffff;
          border: none;
          padding: 7px 15px;
          border-radius: 7px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }

        .download-btn {
          background: #2563eb;
          color: #ffffff;
          border: none;
          padding: 7px 15px;
          border-radius: 7px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }

        .logs-wrapper {
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 1.1rem;
          background: #ffffff;
          min-height: 220px;
          max-height: 480px;
          overflow-y: auto;
          box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.02);
        }
      `}</style>

      {/* Top Header */}
      <div className="workstation-header">
        <div className="header-left">
          <div className="header-icon">
            <PackageMinus size={22} />
          </div>
          <div>
            <h1 className="header-title">PICK Workstation</h1>
            <div className="header-sub">
              Auto FIFO pick by quantity, or select specific serial numbers from Kardex storage
            </div>
          </div>
        </div>

        <button
          type="button"
          className="btn btn-outline-secondary btn-sm d-inline-flex align-items-center gap-1"
          onClick={handleResetAll}
          disabled={isProcessing}
          style={{ fontSize: '12px' }}
        >
          <RotateCcw size={12} />
          <span>Reset Workstation</span>
        </button>
      </div>

      {/* Two-Column Split */}
      <div className="workstation-split">
        {/* Left Column: Command & Selection */}
        <div className="panel-card">
          {/* Mode Switcher */}
          <div className="mode-toggle-bar">
            <button
              type="button"
              className={`mode-tab-btn ${pickMode === 'quick' ? 'active' : ''}`}
              onClick={() => {
                setPickMode('quick');
                setFeedback(null);
                setErrorMsg('');
              }}
              disabled={isProcessing}
            >
              <Zap size={16} className={pickMode === 'quick' ? 'text-warning' : 'text-muted'} />
              <span>Auto Pick (FIFO by Qty)</span>
            </button>

            <button
              type="button"
              className={`mode-tab-btn ${pickMode === 'select' ? 'active' : ''}`}
              onClick={() => {
                setPickMode('select');
                setFeedback(null);
                setErrorMsg('');
              }}
              disabled={isProcessing}
            >
              <ListChecks size={16} className={pickMode === 'select' ? 'text-primary' : 'text-muted'} />
              <span>Select Specific Serials</span>
            </button>
          </div>

          {/* Feedback banner */}
          {feedback && (
            <div
              style={{
                fontSize: '12.5px',
                padding: '8px 12px',
                borderRadius: '7px',
                background: feedback.type === 'success' ? '#f0fdf4' : '#fef2f2',
                border: `1px solid ${feedback.type === 'success' ? '#bbf7d0' : '#fecaca'}`,
                color: feedback.type === 'success' ? '#15803d' : '#991b1b',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              {feedback.type === 'success' ? <Check size={14} /> : <AlertCircle size={14} />}
              <span>{feedback.message}</span>
            </div>
          )}

          {/* =========================================================================
              MODE 1: AUTO PICK (FIFO BY QUANTITY) - BIN-WISE STAGED FLOW
             ========================================================================= */}
          {pickMode === 'quick' && (
            <div className="d-flex flex-column gap-3">
              {/* Barcode Input */}
              <div>
                <div className="d-flex justify-content-between align-items-center mb-1">
                  <label className="field-label mb-0">
                    Scan Model Number or Serial Number
                  </label>
                  {isCheckingStock && (
                    <span className="text-muted d-flex align-items-center gap-1" style={{ fontSize: '11px' }}>
                      <Loader2 size={11} className="spin-animation" /> Checking stock & bins...
                    </span>
                  )}
                  {availableStock !== null && !isCheckingStock && (
                    <span
                      className={`badge ${availableStock > 0 ? 'bg-success-subtle text-success border border-success-subtle' : 'bg-danger-subtle text-danger'}`}
                      style={{ fontSize: '11px' }}
                    >
                      {availableStock > 0 ? `${availableStock} available in Kardex` : 'No available stock'}
                    </span>
                  )}
                </div>

                <div className="field-input-box">
                  <Barcode size={18} className="field-icon" />
                  <input
                    ref={barcodeInputRef}
                    type="text"
                    className="field-input"
                    placeholder="Scan barcode (e.g. SA005157 or S1)..."
                    value={barcodeInput}
                    onChange={(e) => handleBarcodeInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (barcodeInput.trim()) {
                          fetchPickPlanInBackground(barcodeInput, quantity);
                        }
                      }
                    }}
                    onBlur={() => {
                      if (barcodeInput.trim()) {
                        fetchPickPlanInBackground(barcodeInput, quantity);
                      }
                    }}
                    disabled={isProcessing}
                    required
                    autoFocus
                  />
                </div>

                {detectedModel && detectedModel !== barcodeInput.trim() && (
                  <div className="mt-1" style={{ fontSize: '11.5px', color: '#15803d' }}>
                    ✓ Auto-detected Model: <strong>{detectedModel}</strong>
                  </div>
                )}
              </div>

              {/* Quantity to Pick Control */}
              <div>
                <div className="d-flex justify-content-between align-items-center mb-1">
                  <label className="field-label mb-0">Quantity to Pick</label>
                  {availableStock !== null && availableStock > 0 && (
                    <span className="text-muted" style={{ fontSize: '11.5px' }}>
                      Max available: <strong>{availableStock} units</strong>
                    </span>
                  )}
                </div>

                <div className="d-flex align-items-center gap-2">
                  <div className="stepper-box" style={{ width: '180px' }}>
                    <button
                      type="button"
                      className="stepper-btn"
                      onClick={() => handleQuantityChange(Math.max(1, quantity - 1))}
                      disabled={isProcessing || quantity <= 1}
                      title="Decrease Quantity"
                    >
                      <Minus size={15} />
                    </button>
                    <input
                      type="number"
                      min="1"
                      max={availableStock || 9999}
                      className="stepper-input"
                      value={quantity}
                      onChange={(e) =>
                        handleQuantityChange(Math.max(1, Math.min(availableStock || 9999, Number(e.target.value) || 1)))
                      }
                      disabled={isProcessing}
                    />
                    <button
                      type="button"
                      className="stepper-btn"
                      onClick={() => handleQuantityChange(Math.min(availableStock || 9999, quantity + 1))}
                      disabled={isProcessing || (availableStock ? quantity >= availableStock : false)}
                      title="Increase Quantity"
                    >
                      <Plus size={15} />
                    </button>
                  </div>

                  {availableStock !== null && availableStock > 1 && (
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-1"
                      style={{ height: '42px', fontSize: '12px', fontWeight: 600, borderRadius: '8px', padding: '0 14px' }}
                      onClick={() => handleQuantityChange(availableStock)}
                      disabled={isProcessing || quantity === availableStock}
                      title="Pick All Available Units"
                    >
                      <span>Pick All ({availableStock})</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Quick Pick Action Button - Only shown when plan is not yet loaded */}
              {!pickPlan && (
                <button
                  type="button"
                  className="btn-pick-execute mt-1"
                  onClick={handleExecuteQuickPick}
                  disabled={isProcessing || !barcodeInput.trim()}
                >
                  <PackageMinus size={18} />
                  <span>
                    {isProcessing
                      ? 'Validating & Processing Pick Order...'
                      : !barcodeInput.trim()
                      ? 'Scan Model or Serial to Start'
                      : `Auto-Pick ${quantity} Unit${quantity > 1 ? 's' : ''}${
                          detectedModel ? ` (${detectedModel})` : ` (${barcodeInput.trim()})`
                        } → Generate File`}
                  </span>
                </button>
              )}

              {/* BIN ALLOCATION PLAN & BIN-WISE PICKING SECTION */}
              {isLoadingPlan && (
                <div className="text-center py-4 text-muted bg-light rounded border">
                  <Loader2 size={18} className="spin-animation mx-auto mb-1 text-warning" />
                  <div style={{ fontSize: '12px' }}>Analyzing FIFO inventory & bin distribution...</div>
                </div>
              )}

              {pickPlan && !isLoadingPlan && (
                <div className="bin-plan-container">
                  {/* Plan Summary Bar & View Mode Toggle */}
                  <div className="d-flex align-items-center justify-content-between pb-2 border-bottom flex-wrap gap-2">
                    <div className="d-flex align-items-center gap-2">
                      <Layers size={17} className="text-warning" />
                      <strong style={{ fontSize: '13px', color: '#0f172a' }}>
                        Bin Allocation Plan ({pickPlan.allocatedQuantity} Units in {pickPlan.bins.length} Bins)
                      </strong>
                    </div>

                    <div className="d-flex align-items-center gap-2">
                      {/* Density View Switcher (Table vs Cards) */}
                      <div className="d-flex align-items-center bg-light p-1 rounded border gap-1">
                        <button
                          type="button"
                          className={`view-mode-pill ${binViewMode === 'table' ? 'active' : ''}`}
                          onClick={() => setBinViewMode('table')}
                          title="Dense Table View (Best for 10-40 bins)"
                        >
                          <TableIcon size={12} />
                          <span>Table ({pickPlan.bins.length})</span>
                        </button>
                        <button
                          type="button"
                          className={`view-mode-pill ${binViewMode === 'cards' ? 'active' : ''}`}
                          onClick={() => setBinViewMode('cards')}
                          title="Card View"
                        >
                          <LayoutGrid size={12} />
                          <span>Cards</span>
                        </button>
                      </div>

                      <span className="badge bg-secondary-subtle text-secondary border" style={{ fontSize: '11px' }}>
                        {Object.keys(pickedBins).length} / {pickPlan.bins.length} Bins Picked
                      </span>
                    </div>
                  </div>

                  {/* Multi-Bin Search & Checkbox Toolbar */}
                  {(() => {
                    const unpicked = pickPlan.bins.filter((b) => !pickedBins[b.hu_id]);
                    const selected = unpicked.filter((b) => selectedBinHuIds.includes(b.hu_id));
                    const selUnits = selected.reduce((sum, b) => sum + b.qty, 0);
                    const allChecked = unpicked.length > 0 && selected.length === unpicked.length;

                    return (
                      <div className="d-flex flex-column gap-2 p-2 bg-white rounded border">
                        {/* Search Bar for 40+ Bins */}
                        {pickPlan.bins.length > 3 && (
                          <div className="field-input-box" style={{ height: '32px' }}>
                            <Search size={14} className="field-icon" />
                            <input
                              type="text"
                              className="field-input"
                              placeholder={`Filter ${pickPlan.bins.length} bins by ID (e.g. HU-01) or serial...`}
                              value={binSearchQuery}
                              onChange={(e) => setBinSearchQuery(e.target.value)}
                              style={{ height: '32px', fontSize: '12px' }}
                            />
                            {binSearchQuery && (
                              <button
                                type="button"
                                className="btn btn-sm btn-link text-muted p-0 me-2"
                                onClick={() => setBinSearchQuery('')}
                                style={{ fontSize: '11px', textDecoration: 'none' }}
                              >
                                Clear
                              </button>
                            )}
                          </div>
                        )}

                        {/* Selection Toolbar */}
                        <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
                          <div className="d-flex align-items-center gap-2">
                            <button
                              type="button"
                              className={`btn btn-sm ${allChecked ? 'btn-primary' : 'btn-outline-primary'} py-1 px-2 d-inline-flex align-items-center gap-1`}
                              style={{ fontSize: '11.5px' }}
                              onClick={allChecked ? handleDeselectAllBins : handleSelectAllBins}
                              disabled={isProcessing || unpicked.length === 0}
                            >
                              {allChecked ? <CheckSquare size={13} /> : <Square size={13} />}
                              <span>{allChecked ? 'All Bins Selected' : `Select All (${unpicked.length} Bins)`}</span>
                            </button>

                            {selected.length > 0 && (
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-secondary py-1 px-2"
                                style={{ fontSize: '11.5px' }}
                                onClick={handleDeselectAllBins}
                                disabled={isProcessing}
                              >
                                Clear
                              </button>
                            )}
                          </div>

                          <div className="d-flex align-items-center gap-1" style={{ fontSize: '12px' }}>
                            <span className="text-muted">Selected:</span>
                            <span className="badge bg-primary text-white">
                              {selected.length} of {unpicked.length} Bins ({selUnits} Units)
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* ========================================================
                      VIEW MODE A: DENSE TABLE VIEW (OPTIMAL FOR 10 TO 40 BINS)
                     ======================================================== */}
                  {binViewMode === 'table' && (
                    <div className="bin-table-wrapper">
                      <table className="bin-dense-table">
                        <thead>
                          <tr>
                            <th style={{ width: '38px', textAlign: 'center' }}>
                              <div
                                onClick={() => {
                                  const unpicked = pickPlan.bins.filter((b) => !pickedBins[b.hu_id]);
                                  const selected = unpicked.filter((b) => selectedBinHuIds.includes(b.hu_id));
                                  if (selected.length === unpicked.length) handleDeselectAllBins();
                                  else handleSelectAllBins();
                                }}
                                style={{ cursor: 'pointer' }}
                              >
                                {pickPlan.bins.filter((b) => !pickedBins[b.hu_id]).every((b) => selectedBinHuIds.includes(b.hu_id)) ? (
                                  <CheckSquare size={15} className="text-primary" />
                                ) : (
                                  <Square size={15} className="text-secondary" />
                                )}
                              </div>
                            </th>
                            <th style={{ width: '120px' }}>Bin ID</th>
                            <th style={{ width: '65px', textAlign: 'center' }}>Qty</th>
                            <th>Serial Numbers & Slots</th>
                            <th style={{ width: '105px' }}>Status</th>
                            <th style={{ width: '110px', textAlign: 'right' }}>Pick Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredPlanBins.length === 0 && (
                            <tr>
                              <td colSpan={6} className="text-center py-4 text-muted">
                                No bins match &quot;{binSearchQuery}&quot;.
                              </td>
                            </tr>
                          )}
                          {filteredPlanBins.map((bin: PickPlanBin) => {
                            const isPicked = Boolean(pickedBins[bin.hu_id]);
                            const isSelected = selectedBinHuIds.includes(bin.hu_id);
                            const isExpanded = expandedBinHuIds.includes(bin.hu_id);
                            const pickedData = pickedBins[bin.hu_id];

                            return (
                              <tr
                                key={bin.hu_id}
                                className={`${isPicked ? 'completed-row' : isSelected ? 'active-row' : ''}`}
                                onClick={() => {
                                  if (!isPicked) handleToggleBinSelect(bin.hu_id);
                                }}
                                style={{ cursor: !isPicked ? 'pointer' : 'default' }}
                              >
                                {/* Checkbox */}
                                <td style={{ textAlign: 'center' }}>
                                  {!isPicked ? (
                                    <div
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleToggleBinSelect(bin.hu_id);
                                      }}
                                      style={{ cursor: 'pointer' }}
                                    >
                                      {isSelected ? <CheckSquare size={16} className="text-primary" /> : <Square size={16} className="text-secondary" />}
                                    </div>
                                  ) : (
                                    <Check size={14} className="text-success" />
                                  )}
                                </td>

                                {/* Bin ID */}
                                <td>
                                  <div className="d-flex align-items-center gap-1">
                                    <Boxes size={14} className={isPicked ? 'text-success' : isSelected ? 'text-warning' : 'text-secondary'} />
                                    <span className="fw-bold font-monospace text-dark">
                                      {bin.hu_id === 'NO_BIN' ? 'Outside' : bin.hu_id}
                                    </span>
                                  </div>
                                </td>

                                {/* Quantity */}
                                <td style={{ textAlign: 'center' }}>
                                  <span className="badge bg-primary-subtle text-primary border border-primary-subtle">
                                    {bin.qty}
                                  </span>
                                </td>

                                {/* Serials & Slots */}
                                <td>
                                  <div className="d-flex flex-wrap gap-1 align-items-center">
                                    {(isExpanded ? bin.items : bin.items.slice(0, 3)).map((item: PickPlanItem) => (
                                      <span key={item.serial_number} className="serial-chip py-0 px-1" style={{ fontSize: '10.5px' }}>
                                        <span className="serial-slot-tag" style={{ fontSize: '9px', padding: '0 3px' }}>
                                          {item.compartment_number ? `#${item.compartment_number}` : 'D'}
                                        </span>
                                        <span className="serial-num-text">{item.serial_number}</span>
                                      </span>
                                    ))}

                                    {bin.items.length > 3 && (
                                      <button
                                        type="button"
                                        className="btn btn-sm btn-link p-0 text-muted d-inline-flex align-items-center gap-1"
                                        style={{ fontSize: '10.5px', textDecoration: 'none' }}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          toggleBinExpand(bin.hu_id);
                                        }}
                                      >
                                        {isExpanded ? (
                                          <>
                                            <ChevronUp size={11} />
                                            <span>Less</span>
                                          </>
                                        ) : (
                                          <>
                                            <ChevronDown size={11} />
                                            <span>+{bin.items.length - 3} more</span>
                                          </>
                                        )}
                                      </button>
                                    )}
                                  </div>
                                </td>

                                {/* Status */}
                                <td>
                                  {isPicked ? (
                                    <span className="badge bg-success text-white py-1 px-2" style={{ fontSize: '10px' }}>
                                      ✅ Picked ({pickedData?.lineCount})
                                    </span>
                                  ) : isSelected ? (
                                    <span className="badge bg-warning text-dark py-1 px-2 fw-bold" style={{ fontSize: '10px' }}>
                                      👉 Ready
                                    </span>
                                  ) : (
                                    <span className="badge bg-light text-muted border py-1 px-2" style={{ fontSize: '10px' }}>
                                      ⚪ Unselected
                                    </span>
                                  )}
                                </td>

                                {/* Action */}
                                <td style={{ textAlign: 'right' }}>
                                  {isPicked && pickedData?.pickId ? (
                                    <button
                                      type="button"
                                      className="btn btn-sm btn-outline-success py-0 px-2 d-inline-flex align-items-center gap-1"
                                      style={{ fontSize: '10.5px' }}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDownloadFileById(pickedData.pickId);
                                      }}
                                      disabled={isDownloading}
                                    >
                                      <Download size={10} />
                                      <span>File</span>
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      className="btn btn-sm btn-outline-warning py-0 px-2 d-inline-flex align-items-center gap-1 fw-bold"
                                      style={{ fontSize: '10.5px' }}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setActiveBinHuId(bin.hu_id);
                                        executeBinPick(bin);
                                      }}
                                      disabled={isProcessing}
                                    >
                                      <PackageMinus size={11} />
                                      <span>Pick ({bin.qty})</span>
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* ========================================================
                      VIEW MODE B: CARDS VIEW
                     ======================================================== */}
                  {binViewMode === 'cards' && (
                    <div className="bin-scroll-cards-wrapper">
                      {filteredPlanBins.map((bin: PickPlanBin) => {
                        const isPicked = Boolean(pickedBins[bin.hu_id]);
                        const isSelected = selectedBinHuIds.includes(bin.hu_id);
                        const pickedData = pickedBins[bin.hu_id];

                        return (
                          <div
                            key={bin.hu_id}
                            className={`bin-card ${isPicked ? 'completed' : isSelected ? 'active' : ''}`}
                            onClick={() => {
                              if (!isPicked) handleToggleBinSelect(bin.hu_id);
                            }}
                            style={{ cursor: !isPicked ? 'pointer' : 'default' }}
                          >
                            <div className="d-flex align-items-center justify-content-between">
                              <div className="d-flex align-items-center gap-2">
                                {!isPicked && (
                                  <div
                                    className="text-primary flex-shrink-0"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleToggleBinSelect(bin.hu_id);
                                    }}
                                    style={{ cursor: 'pointer' }}
                                  >
                                    {isSelected ? <CheckSquare size={18} /> : <Square size={18} className="text-secondary" />}
                                  </div>
                                )}

                                <Boxes size={16} className={isPicked ? 'text-success' : isSelected ? 'text-warning' : 'text-secondary'} />
                                <span className="fw-bold font-monospace text-dark" style={{ fontSize: '13.5px' }}>
                                  {bin.hu_id === 'NO_BIN' ? 'Standalone / Outside Bin' : `Bin ${bin.hu_id}`}
                                </span>
                                <span className="badge bg-primary-subtle text-primary border border-primary-subtle" style={{ fontSize: '11px' }}>
                                  {bin.qty} Unit{bin.qty > 1 ? 's' : ''}
                                </span>
                              </div>

                              <div>
                                {isPicked ? (
                                  <span className="badge bg-success text-white d-inline-flex align-items-center gap-1" style={{ fontSize: '11px' }}>
                                    <Check size={11} /> Picked ({pickedData?.lineCount} units)
                                  </span>
                                ) : isSelected ? (
                                  <span className="badge bg-warning text-dark d-inline-flex align-items-center gap-1 fw-bold" style={{ fontSize: '11px' }}>
                                    👉 Ready
                                  </span>
                                ) : (
                                  <span className="badge bg-light text-muted border" style={{ fontSize: '11px' }}>
                                    ⚪ Unselected
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="serial-chips-grid">
                              {bin.items.map((item: PickPlanItem) => (
                                <div key={item.serial_number} className="serial-chip">
                                  <span className="serial-slot-tag">
                                    {item.compartment_number ? `Slot #${item.compartment_number}` : 'Direct'}
                                  </span>
                                  <span className="serial-num-text">{item.serial_number}</span>
                                </div>
                              ))}
                            </div>

                            <div className="d-flex align-items-center justify-content-between pt-1 mt-1 border-top" style={{ fontSize: '11.5px' }}>
                              <span className="text-muted">
                                {bin.qty} unit{bin.qty > 1 ? 's' : ''} in {bin.hu_id}
                              </span>

                              <div className="d-flex align-items-center gap-2">
                                {isPicked && pickedData?.pickId ? (
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-outline-success py-0 px-2 d-inline-flex align-items-center gap-1"
                                    style={{ fontSize: '11px' }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDownloadFileById(pickedData.pickId);
                                    }}
                                    disabled={isDownloading}
                                  >
                                    <Download size={11} />
                                    <span>Download File</span>
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-outline-warning py-0 px-2 d-inline-flex align-items-center gap-1 fw-bold"
                                    style={{ fontSize: '11px' }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setActiveBinHuId(bin.hu_id);
                                      executeBinPick(bin);
                                    }}
                                    disabled={isProcessing}
                                  >
                                    <PackageMinus size={11} />
                                    <span>Pick This Bin Only ({bin.qty})</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* STICKY BOTTOM ACTION BAR: PICK SELECTED BINS */}
                  {(() => {
                    const unpicked = pickPlan.bins.filter((b) => !pickedBins[b.hu_id]);
                    const selected = unpicked.filter((b) => selectedBinHuIds.includes(b.hu_id));
                    const selUnits = selected.reduce((sum, b) => sum + b.qty, 0);

                    if (unpicked.length > 0 && !isSessionFinished) {
                      if (selected.length > 0) {
                        return (
                          <div className="d-flex align-items-center justify-content-between p-2 rounded bg-white border mt-1 flex-wrap gap-2">
                            <div className="d-flex align-items-center gap-2">
                              <span className="fw-bold text-dark" style={{ fontSize: '12.5px' }}>
                                Ready to Pick:
                              </span>
                              <span className="badge bg-primary text-white">
                                {selected.length} of {unpicked.length} Bins ({selUnits} Units)
                              </span>
                            </div>

                            <button
                              type="button"
                              className="btn-pick-execute"
                              style={{ width: 'auto', minWidth: '220px', height: '42px', fontSize: '13px' }}
                              onClick={executeSelectedBinsPick}
                              disabled={isProcessing}
                            >
                              <PackageMinus size={16} />
                              <span>
                                {isProcessing
                                  ? 'Generating Pick Order...'
                                  : selected.length === unpicked.length && unpicked.length === pickPlan.bins.length
                                  ? `Pick All ${selected.length} Bins (${selUnits} Units) → File`
                                  : `Pick ${selected.length} Selected Bins (${selUnits} Units) → File`}
                              </span>
                            </button>
                          </div>
                        );
                      } else {
                        return (
                          <div className="d-flex align-items-center justify-content-between p-2 rounded bg-light border mt-1 flex-wrap gap-2">
                            <div className="d-flex align-items-center gap-2">
                              <span className="fw-bold text-muted" style={{ fontSize: '12.5px' }}>
                                Ready to Pick:
                              </span>
                              <span className="badge bg-secondary text-white">
                                0 of {unpicked.length} Bins (0 Units)
                              </span>
                              <span className="text-muted" style={{ fontSize: '11.5px' }}>
                                (Select checkbox on bin to pick)
                              </span>
                            </div>

                            <button
                              type="button"
                              className="btn btn-secondary disabled"
                              style={{ width: 'auto', minWidth: '220px', height: '42px', fontSize: '13px', opacity: 0.65, cursor: 'not-allowed' }}
                              disabled={true}
                            >
                              <PackageMinus size={16} />
                              <span>Check Bins to Pick → File</span>
                            </button>
                          </div>
                        );
                      }
                    }
                    return null;
                  })()}

                  {/* PARTIAL PICK ACTION ("Take Half Only") */}
                  {Object.keys(pickedBins).length > 0 && !pickPlan.bins.every((b) => Boolean(pickedBins[b.hu_id])) && !isSessionFinished && (
                    <div className="p-2 rounded bg-warning-subtle border border-warning-subtle d-flex flex-column gap-2 mt-1">
                      <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
                        <div>
                          <div className="fw-bold text-dark" style={{ fontSize: '12px' }}>
                            Taking half only? ({Object.values(pickedBins).reduce((sum, b) => sum + b.lineCount, 0)} of {pickPlan.allocatedQuantity} units picked)
                          </div>
                          <div className="text-muted" style={{ fontSize: '11px' }}>
                            Stopping now keeps unpicked bins safe in Kardex with zero false Kanban-Out.
                          </div>
                        </div>

                        <button
                          type="button"
                          className="btn-finish-early"
                          onClick={handleFinishEarly}
                          disabled={isProcessing}
                        >
                          <CheckCheck size={14} />
                          <span>Finish Pick Session</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* ALL BINS COMPLETED OR USER FINISHED EARLY */}
                  {(pickPlan.bins.every((b) => Boolean(pickedBins[b.hu_id])) || (isSessionFinished && Object.keys(pickedBins).length > 0)) && (
                    <div className="p-3 rounded bg-success-subtle border border-success-subtle d-flex align-items-center justify-content-between flex-wrap gap-2 mt-1">
                      <div>
                        <div className="fw-bold text-success d-flex align-items-center gap-1" style={{ fontSize: '13px' }}>
                          <CheckCircle2 size={16} /> Pick Session Finished!
                        </div>
                        <div className="text-muted" style={{ fontSize: '11.5px' }}>
                          {Object.values(pickedBins).reduce((sum, b) => sum + b.lineCount, 0)} units picked across {Object.keys(pickedBins).length} bin(s).
                          {!pickPlan.bins.every((b) => Boolean(pickedBins[b.hu_id])) && ' (Session ended early)'}
                        </div>
                      </div>

                      <div className="d-flex align-items-center gap-2">
                        {!pickPlan.bins.every((b) => Boolean(pickedBins[b.hu_id])) && (
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-success"
                            onClick={() => {
                              const unpicked = pickPlan.bins.filter((b) => !pickedBins[b.hu_id]);
                              setIsSessionFinished(false);
                              if (unpicked.length > 0) {
                                setSelectedBinHuIds([unpicked[0].hu_id]);
                              }
                            }}
                          >
                            Resume Picking
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn btn-sm btn-success d-inline-flex align-items-center gap-1"
                          onClick={handleResetAll}
                        >
                          <span>Pick Next Model</span>
                          <ArrowRight size={13} />
                        </button>
                      </div>
                    </div>
                  )}


                </div>
              )}
            </div>
          )}

          {/* =========================================================================
              MODE 2: SELECT SPECIFIC SERIALS (AUTO-LOADS AS YOU TYPE/SCAN)
             ========================================================================= */}
          {pickMode === 'select' && (
            <div className="d-flex flex-column gap-3">
              {/* Model Input with Auto-Load */}
              <div>
                <div className="d-flex justify-content-between align-items-center mb-1">
                  <label className="field-label mb-0">
                    Scan or Enter Model Number
                  </label>
                  {isLoadingInventory && (
                    <span className="text-muted d-flex align-items-center gap-1" style={{ fontSize: '11px' }}>
                      <Loader2 size={11} className="spin-animation" /> Loading available stock...
                    </span>
                  )}
                  {inventoryList.length > 0 && (
                    <span className="badge bg-success-subtle text-success border border-success-subtle" style={{ fontSize: '11px' }}>
                      {inventoryList.length} serials in stock
                    </span>
                  )}
                </div>

                <div className="field-input-box">
                  <Search size={18} className="field-icon" />
                  <input
                    ref={selectModelInputRef}
                    type="text"
                    className="field-input"
                    placeholder="Enter model number (e.g. SA005157)..."
                    value={selectModelInput}
                    onChange={(e) => handleSelectModelInputChange(e.target.value)}
                    disabled={isProcessing}
                    autoFocus
                  />
                </div>
              </div>

              {/* Target Quantity Stepper */}
              {inventoryList.length > 0 && (
                <div className="d-flex align-items-center justify-content-between p-2 rounded bg-light border">
                  <div>
                    <strong style={{ fontSize: '13px', color: '#0f172a' }}>
                      Model: {resolvedSelectModel}
                    </strong>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>
                      Available in Kardex: {inventoryList.length} units
                    </div>
                  </div>

                  <div className="d-flex align-items-center gap-2">
                    <span style={{ fontSize: '12px', fontWeight: 600 }}>Target:</span>
                    <div className="stepper-box" style={{ width: '120px', height: '34px' }}>
                      <button
                        type="button"
                        className="stepper-btn"
                        onClick={() => setSelectTargetQty((q) => Math.max(1, q - 1))}
                        disabled={isProcessing || selectTargetQty <= 1}
                        title="Decrease Target"
                      >
                        <Minus size={12} />
                      </button>
                      <input
                        type="number"
                        min="1"
                        max={inventoryList.length || 1}
                        className="stepper-input"
                        value={selectTargetQty}
                        onChange={(e) => {
                          const val = Number(e.target.value) || 1;
                          const maxStock = Math.max(1, inventoryList.length);
                          setSelectTargetQty(Math.max(1, Math.min(maxStock, val)));
                        }}
                        disabled={isProcessing}
                        style={{ fontSize: '13px' }}
                      />
                      <button
                        type="button"
                        className="stepper-btn"
                        onClick={() => setSelectTargetQty((q) => Math.min(inventoryList.length || 1, q + 1))}
                        disabled={isProcessing || selectTargetQty >= inventoryList.length}
                        title={selectTargetQty >= inventoryList.length ? 'Maximum available stock reached' : 'Increase Target'}
                      >
                        <Plus size={12} />
                      </button>
                    </div>

                    {inventoryList.length > 1 && (
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary py-0 px-2"
                        style={{ height: '34px', fontSize: '11.5px', fontWeight: 600, borderRadius: '6px', whiteSpace: 'nowrap' }}
                        onClick={() => setSelectTargetQty(inventoryList.length)}
                        disabled={isProcessing || selectTargetQty === inventoryList.length}
                        title="Pick all available units"
                      >
                        All ({inventoryList.length})
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Serials Checklist */}
              {inventoryList.length > 0 && (
                <div className="p-2 rounded bg-light border d-flex flex-column gap-2">
                  {/* Toolbar */}
                  <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
                    <span className="badge bg-primary text-white">
                      Selected: {selectedSerialNumbers.length} / {selectTargetQty}
                    </span>

                    <div className="d-flex align-items-center gap-1">
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary py-1 px-2"
                        style={{ fontSize: '11.5px' }}
                        onClick={handleSelectFirstN}
                        disabled={isProcessing}
                      >
                        Select First {selectTargetQty}
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary py-1 px-2"
                        style={{ fontSize: '11.5px' }}
                        onClick={handleDeselectAll}
                        disabled={isProcessing || selectedSerialNumbers.length === 0}
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  {/* Filter Search */}
                  <div className="field-input-box">
                    <Search size={14} className="field-icon" />
                    <input
                      type="text"
                      className="field-input"
                      placeholder="Filter serials or slot..."
                      value={inventorySearch}
                      onChange={(e) => setInventorySearch(e.target.value)}
                      style={{ height: '34px', fontSize: '12px' }}
                    />
                  </div>

                  {/* Serials List */}
                  <div className="inventory-table-container">
                    {filteredInventory.map((item) => {
                      const isSelected = selectedSerialNumbers.includes(item.serial_number);
                      return (
                        <div
                          key={item.serial_number}
                          className={`inventory-row ${isSelected ? 'selected' : ''}`}
                          onClick={() => handleToggleSelectSerial(item.serial_number)}
                        >
                          <div className="text-primary flex-shrink-0">
                            {isSelected ? <CheckSquare size={16} /> : <Square size={16} />}
                          </div>

                          <span className="font-monospace fw-bold text-dark flex-1">
                            {item.serial_number}
                          </span>

                          <div className="d-flex align-items-center gap-1 text-muted" style={{ fontSize: '11px' }}>
                            <MapPin size={11} />
                            <span>
                              {item.handling_unit?.hu_id || 'Bin'} (Slot #{item.compartment?.compartment_number || '-'})
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Execute Selected Pick Button */}
              <button
                type="button"
                className="btn-pick-execute mt-1"
                onClick={handleExecuteSelectedPick}
                disabled={isProcessing || selectedSerialNumbers.length === 0}
              >
                <PackageMinus size={18} />
                <span>
                  {isProcessing
                    ? 'Validating & Processing Selected Serials...'
                    : selectedSerialNumbers.length === 0
                    ? selectModelInput.trim()
                      ? 'Select Serial Numbers from List Above'
                      : 'Scan or Enter Model Number to View Serials'
                    : `Pick ${selectedSerialNumbers.length} Selected Serials → Generate File`}
                </span>
              </button>
            </div>
          )}
        </div>

        {/* Right Column: Live MES Verification & Status Monitor */}
        <div className="panel-card monitor-panel">
          <div className="d-flex align-items-center justify-content-between pb-2 border-bottom">
            <h2 className="panel-title d-flex align-items-center gap-2 m-0" style={{ fontSize: '15px' }}>
              <ShieldCheck size={18} className="text-success" />
              <span>Live MES Verification & File Generation</span>
            </h2>

            {isProcessing && (
              <span className="badge bg-primary-subtle text-primary border border-primary-subtle d-inline-flex align-items-center gap-1 py-1 px-2">
                <Loader2 size={12} className="spin-animation" /> Processing Live
              </span>
            )}
          </div>

          {/* Success Banner */}
          {isCompleted && (
            <div className="success-banner">
              <div className="d-flex align-items-center gap-3">
                <CheckCircle2 size={26} className="text-success flex-shrink-0" />
                <div>
                  <div className="fw-bold text-dark" style={{ fontSize: '14px' }}>
                    Pick Order Generated Successfully!
                  </div>
                  <div style={{ fontSize: '12.5px', color: '#15803d' }}>
                    Generated <strong>{completedInfo?.lineCount || 1} line item{completedInfo?.lineCount && completedInfo.lineCount > 1 ? 's' : ''}</strong>{' '}
                    ({completedInfo?.label}) in file:{' '}
                    <span className="font-monospace fw-bold">{completedInfo?.fileName}</span>
                  </div>
                </div>
              </div>

              <div className="d-flex align-items-center gap-2">
                {completedInfo?.pickId && (
                  <button
                    type="button"
                    className="download-btn"
                    onClick={handleDownloadFile}
                    disabled={isDownloading}
                  >
                    <Download size={14} />
                    <span>{isDownloading ? 'Downloading...' : 'Download Pick File'}</span>
                  </button>
                )}

                <button type="button" className="success-btn" onClick={handleResetAll}>
                  <span>Pick Next</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          )}

          {/* Bin Pick Files Generated List */}
          {completedBinFiles.length > 0 && (
            <div
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                padding: '12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <div className="d-flex align-items-center justify-content-between">
                <strong style={{ fontSize: '13px', color: '#0f172a' }}>
                  Generated Bin Pick Files ({completedBinFiles.length}):
                </strong>
                <span className="badge bg-success-subtle text-success border border-success-subtle" style={{ fontSize: '11px' }}>
                  {completedBinFiles.reduce((acc, f) => acc + f.lineCount, 0)} Units Picked
                </span>
              </div>

              <div className="d-flex flex-column gap-2">
                {completedBinFiles.map((file, idx) => (
                  <div
                    key={idx}
                    className="p-2 rounded bg-white border d-flex flex-column gap-1"
                    style={{ fontSize: '12px' }}
                  >
                    <div className="d-flex align-items-center justify-content-between flex-wrap gap-1">
                      <span className="badge bg-secondary-subtle text-secondary border font-monospace">
                        Bin {file.huId}
                      </span>
                      <span className="badge bg-success-subtle text-success border border-success-subtle" style={{ fontSize: '11px' }}>
                        {file.lineCount} unit{file.lineCount > 1 ? 's' : ''}
                      </span>
                    </div>

                    <div className="d-flex align-items-center justify-content-between gap-2 mt-1">
                      <span
                        className="font-monospace fw-bold text-dark text-truncate"
                        title={file.fileName}
                        style={{ fontSize: '11.5px', maxWidth: '250px' }}
                      >
                        {file.fileName}
                      </span>

                      <button
                        type="button"
                        className="btn btn-sm btn-outline-primary py-1 px-2 d-inline-flex align-items-center gap-1 flex-shrink-0"
                        style={{ fontSize: '11.5px', borderRadius: '6px' }}
                        onClick={() => handleDownloadFileById(file.pickId)}
                        disabled={isDownloading}
                      >
                        <Download size={12} />
                        <span>Download</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Error Banner */}
          {errorMsg && (
            <div
              style={{
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '10px',
                padding: '0.85rem 1.1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                color: '#991b1b',
                fontSize: '13px',
              }}
            >
              <AlertCircle size={20} className="flex-shrink-0" />
              <div className="flex-1">
                <strong>Error: </strong> {errorMsg}
              </div>
              <button
                type="button"
                className="btn btn-sm btn-outline-danger ms-auto"
                style={{ fontSize: '12px', padding: '3px 8px' }}
                onClick={() => setErrorMsg('')}
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Timeline Logs Section */}
          <div className="logs-wrapper">
            {logs.length === 0 && !isProcessing && !isCompleted && (
              <div className="text-center py-5 text-muted" style={{ fontSize: '13px' }}>
                <Clock size={32} className="text-secondary opacity-50 mb-2 d-block mx-auto" />
                Scan barcode on the left to begin. Live MES validation will stream here.
              </div>
            )}

            {(isProcessing || logs.length > 0) && (
              <>
                <TimelineProgress
                  logs={logs}
                  steps={PICK_STEPS}
                  isProcessing={isProcessing}
                />
                <div ref={logsEndRef} />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
