import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { downloadPdf } from '../utils/downloadPdf';
import { formatApiError } from '../utils/apiErrors';
import { fillBlankSampleNumbers, nextSampleNumber } from '../utils/sampleNumbers';
import AddressInput from '../components/AddressInput';
import { normalizeReportAddress } from '../utils/reportUtils';

const emptySample = (blank = false) => ({
  sample_number: '', description: blank ? 'Field Blank' : '', sample_date: '',
  start: '', end: '', flow_rate: '', fibers: '', fields: 100,
  is_blank: blank, blank_type: blank ? 'Field Blank' : null,
  status: 'normal', reject_note: '',
});
const defaultDate = () => new Date().toISOString().slice(0, 10);
const ensureRequiredBlanks = (samples, reportDate) => {
  const next = [...(samples || [])];
  if (!next.some(s => s.is_blank && s.blank_type === 'Field Blank')) {
    next.push({ ...emptySample(true), sample_date: reportDate, description: 'Field Blank', blank_type: 'Field Blank' });
  }
  if (!next.some(s => s.is_blank && s.blank_type === 'Lab Blank')) {
    next.push({ ...emptySample(true), sample_date: reportDate, description: 'Lab Blank', blank_type: 'Lab Blank' });
  }
  return next;
};

const minutesBetween = (start, end) => {
  if (!start || !end) return null;
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const value = eh * 60 + em - sh * 60 - sm;
  return value > 0 ? value : null;
};

const calculatedRows = (samples) => {
  const fieldBlanks = samples.filter(s => s.is_blank && s.blank_type === 'Field Blank' && s.fibers !== '');
  const blankAverage = fieldBlanks.length
    ? fieldBlanks.reduce((sum, s) => sum + Number(s.fibers || 0), 0) / fieldBlanks.length : 0;
  return samples.map(s => {
    if (s.is_blank) return { ...s, total_minutes: null, volume: null, fiber_density: Number(s.fibers || 0) / Number(s.fields || 1) / 0.00785, fiber_concentration: null };
    if (s.status !== 'normal') return { ...s, total_minutes: null, volume: null, fiber_density: null, fiber_concentration: null };
    const total = minutesBetween(s.start, s.end);
    const volume = total && Number(s.flow_rate) > 0 ? Number(s.flow_rate) * total : null;
    const density = s.fibers !== '' && Number(s.fields) > 0
      ? ((Number(s.fibers) / Number(s.fields)) - (blankAverage / Number(s.fields))) / 0.00785 : null;
    const concentration = density !== null && volume ? density * 385 / (volume * 1000) : null;
    return { ...s, total_minutes: total, volume, fiber_density: density, fiber_concentration: concentration };
  });
};

function SignatureCanvas({ value, onChange }) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    context.clearRect(0, 0, canvas.width, canvas.height);
    if (!value) return;
    const image = new window.Image();
    image.onload = () => {
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
    };
    image.src = value;
  }, [value]);
  const point = (event) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const source = event.touches?.[0] || event;
    return {
      x: (source.clientX - rect.left) * (canvasRef.current.width / rect.width),
      y: (source.clientY - rect.top) * (canvasRef.current.height / rect.height),
    };
  };
  const start = (event) => {
    event.preventDefault();
    drawing.current = true;
    const p = point(event);
    const ctx = canvasRef.current.getContext('2d');
    ctx.beginPath(); ctx.moveTo(p.x, p.y);
  };
  const move = (event) => {
    if (!drawing.current) return;
    event.preventDefault();
    const p = point(event);
    const ctx = canvasRef.current.getContext('2d');
    ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.strokeStyle = '#111827';
    ctx.lineTo(p.x, p.y); ctx.stroke();
  };
  const end = () => {
    if (!drawing.current) return;
    drawing.current = false;
    onChange(canvasRef.current.toDataURL('image/png'));
  };
  const clear = () => {
    const canvas = canvasRef.current;
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    onChange('');
  };
  return <div>
    <canvas ref={canvasRef} width="500" height="130" className="w-full max-w-xl h-32 bg-white border rounded touch-none"
      onMouseDown={start} onMouseMove={move} onMouseUp={end} onMouseLeave={end}
      onTouchStart={start} onTouchMove={move} onTouchEnd={end} aria-label="Draw analyst signature" />
    <button type="button" className="mt-2 text-sm text-blue-600" onClick={clear}>Clear signature</button>
  </div>;
}

export default function ReportCreator() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const initialProjectId = params.get('projectId') || '';
  const initialReportId = params.get('reportId') || '';
  const [step, setStep] = useState(0);
  const [projects, setProjects] = useState([]);
  const [addresses, setAddresses] = useState([]);
  const [people, setPeople] = useState([]);
  const [reportId, setReportId] = useState(initialReportId);
  const [pdfUrl, setPdfUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [savingSignature, setSavingSignature] = useState(false);
  const [signatureMessage, setSignatureMessage] = useState('');
  const nextWarningKey = useRef('');
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    project_id: initialProjectId, report_kind: 'area', report_date: defaultDate(),
    formatted_address: '', google_place_id: '', latitude: null, longitude: null,
    location_label: '', worker_name: '', technician_user_id: null, technician_name: '',
    analyst_user_id: user?.id || '', analyzed_date: new Date().toISOString().slice(0,10),
    analytical_procedure: 'NIOSH 7400 PCM*', project_additional_info: '', notes: '',
    samples: [
      { ...emptySample(false), sample_date: defaultDate() },
      { ...emptySample(true), sample_date: defaultDate(), description: 'Field Blank', blank_type: 'Field Blank' },
      { ...emptySample(true), sample_date: defaultDate(), description: 'Lab Blank', blank_type: 'Lab Blank' },
    ], signature_data_url: '',
    save_signature_as_default: false,
  });
  const rows = useMemo(() => calculatedRows(form.samples), [form.samples]);
  const twa = useMemo(() => rows.reduce((sum, r) => sum + (r.fiber_concentration || 0) * (r.total_minutes || 0), 0) / 480, [rows]);
  const analysts = people.filter(p => p.highest_level >= 60);
  const selectedAnalyst = analysts.find(person => String(person.id) === String(form.analyst_user_id));

  useEffect(() => {
    const level = Math.max(Number(user?.highest_level || 0), ...(user?.roles || []).map(r => Number(r.level || 0)));
    if (!user?.is_superuser && level < 60) { navigate('/dashboard', { replace: true }); return; }
    Promise.all([
      api.get('/api/v1/projects/'),
      api.get('/api/v1/reports/air-sample/options'),
    ]).then(([p, o]) => {
      const projectList = p.data || [];
      setProjects(projectList);
      setPeople(o.data || []);
      if (!initialReportId && initialProjectId) {
        const selected = projectList.find(project => String(project.id) === String(initialProjectId));
        if (selected && !selected.company_id) {
          setForm(current => ({ ...current, project_id: '' }));
          setError(`"${selected.name}" must be assigned to a client company before creating a report.`);
        }
      }
    }).catch(() => setError('Failed to load report options'));
  }, [initialProjectId, initialReportId, navigate, user]);

  useEffect(() => {
    if (!form.project_id) return;
    api.get(`/api/v1/projects/${form.project_id}/addresses`).then(resp => {
      const list = resp.data || []; setAddresses(list);
      if (list[0]?.formatted_address) setForm(f => f.formatted_address ? f : ({
        ...f, formatted_address: list[0].formatted_address,
        google_place_id: list[0].google_place_id || `manual-${f.project_id}`,
        latitude: list[0].latitude, longitude: list[0].longitude,
      }));
    }).catch(() => setAddresses([]));
  }, [form.project_id]);

  useEffect(() => {
    if (!initialReportId) return;
    api.get(`/api/v1/reports/${initialReportId}`).then(resp => {
      const r = resp.data;
      if (r.is_final) throw new Error('Finalized reports cannot be edited');
      const d = r.report_data || {};
      setForm(f => {
        const loaded = d.samples?.map(s => ({...s, start:s.start||'', end:s.end||'', flow_rate:s.flow_rate??'', fibers:s.fibers??'', fields:s.fields??'', reject_note:s.reject_note||''})) || f.samples;
        return { ...f, ...d, project_id: r.project_id, report_kind: r.report_kind, report_date: r.report_date, formatted_address: r.formatted_address, google_place_id: r.google_place_id, location_label: r.location_label || '', worker_name: r.worker_name || '', technician_user_id: r.technician_user_id, technician_name: r.technician_name || '', samples: ensureRequiredBlanks(loaded, r.report_date), signature_data_url: d.signature_snapshot || '' };
      });
    }).catch(err => setError(err.message || 'Failed to load draft'));
  }, [initialReportId]);

  useEffect(() => () => { if (pdfUrl) URL.revokeObjectURL(pdfUrl); }, [pdfUrl]);

  const set = (key, value) => setForm(f => ({ ...f, [key]: value }));
  const updateSample = (index, key, value) => setForm(f => ({ ...f, samples: f.samples.map((s,i) => i === index ? {...s,[key]:value} : s) }));
  const addSample = (blank, description = '') => setForm(f => {
    const sameKind = f.samples.filter(sample => Boolean(sample.is_blank) === Boolean(blank));
    const previous = sameKind.at(-1);
    const blankType = blank ? 'Field Blank' : null;
    const sample = {
      ...emptySample(blank),
      sample_number: nextSampleNumber(f.samples, blank),
      sample_date: previous?.sample_date || f.report_date,
      description: description || (blank ? blankType : ''),
      blank_type: blankType,
    };
    return { ...f, samples: [...f.samples, sample] };
  });
  const changeStep = target => {
    if (target === 2) {
      setForm(current => ({ ...current, samples: fillBlankSampleNumbers(current.samples) }));
    }
    setStep(target);
  };
  const missingFieldsForStep = targetStep => {
    if (targetStep === 0) {
      return [
        !form.project_id && 'Project',
        !form.report_kind && 'Report type',
        !form.report_date && 'Report date',
        !form.formatted_address?.trim() && 'Project address',
        !form.technician_name?.trim() && 'Technician',
        form.report_kind === 'personal' && !form.worker_name?.trim() && 'Worker/person name',
      ].filter(Boolean);
    }

    const stepSamples = form.samples
      .map((sample, index) => ({ sample, index }))
      .filter(({ sample }) => Boolean(sample.is_blank) === (targetStep === 2));
    const missing = [];
    stepSamples.forEach(({ sample, index }) => {
      const label = `${sample.is_blank ? 'Blank' : 'Sample'} row ${index + 1}`;
      if (!sample.sample_number?.trim()) missing.push(`${label}: sample number`);
      if (!sample.description?.trim()) missing.push(`${label}: description`);
      if (!sample.sample_date) missing.push(`${label}: date`);
      if (sample.is_blank) {
        if (sample.fibers === '') missing.push(`${label}: fibers`);
        if (sample.fields === '' || Number(sample.fields) <= 0) missing.push(`${label}: fields`);
      } else if (sample.status === 'rejected') {
        if (!sample.reject_note?.trim()) missing.push(`${label}: rejection reason`);
      } else if (sample.status === 'normal') {
        if (!sample.start) missing.push(`${label}: start time`);
        if (!sample.end) missing.push(`${label}: end time`);
        if (sample.flow_rate === '' || Number(sample.flow_rate) <= 0) missing.push(`${label}: flow rate`);
        if (sample.fibers === '') missing.push(`${label}: fibers`);
        if (sample.fields === '' || Number(sample.fields) <= 0) missing.push(`${label}: fields`);
      }
    });
    return missing;
  };
  const goToNextStep = () => {
    const missing = missingFieldsForStep(step);
    const warningKey = `${step}:${missing.join('|')}`;
    if (missing.length && nextWarningKey.current !== warningKey) {
      nextWarningKey.current = warningKey;
      window.alert(
        `The following required fields are incomplete:\n\n${missing.join('\n')}\n\n`
        + 'Complete them now, or click Next again to continue anyway.',
      );
      return;
    }
    nextWarningKey.current = '';
    changeStep(step + 1);
  };
  const removeSample = index => {
    const sample = form.samples[index];
    if (sample?.is_blank) {
      const sameType = form.samples.filter(s => s.is_blank && s.blank_type === sample.blank_type);
      if (sameType.length <= 1) {
        window.alert(`Every report requires one ${sample.blank_type}.`);
        return;
      }
    }
    if (!window.confirm(`Remove sample ${sample?.sample_number || index + 1}? This cannot be undone.`)) return;
    setForm(f => ({ ...f, samples: f.samples.filter((_,i) => i !== index) }));
  };
  const chooseAddress = value => {
    const a = addresses.find(x => String(x.id) === value);
    if (a) setForm(f => ({ ...f, formatted_address:a.formatted_address, google_place_id:a.google_place_id || `manual-${a.id}`, latitude:a.latitude, longitude:a.longitude }));
  };
  const addressValue = {
    formatted_address: form.formatted_address,
    google_place_id: form.google_place_id,
    latitude: form.latitude,
    longitude: form.longitude,
    address_line1: form.formatted_address,
  };
  const updateAddress = address => {
    const formatted = normalizeReportAddress(address) || [
      address.address_line1,
      address.address_line2,
      address.city,
      [address.state, address.zip].filter(Boolean).join(' '),
    ].filter(Boolean).join(', ');
    setForm(f => ({
      ...f,
      formatted_address: formatted,
      google_place_id: address.google_place_id || (formatted ? `manual-${f.project_id || 'address'}` : ''),
      latitude: address.latitude ?? null,
      longitude: address.longitude ?? null,
    }));
  };
  const choosePerson = (kind, id) => {
    const person = people.find(p => String(p.id) === id);
    if (kind === 'technician') setForm(f => ({...f,technician_user_id:person?.id||null,technician_name:person?.name||''}));
    else setForm(f => ({
      ...f,
      analyst_user_id: person?.id || '',
      signature_data_url: person?.signature_data_url || '',
      save_signature_as_default: false,
    }));
    setSignatureMessage('');
  };

  const saveSignature = async () => {
    if (!form.analyst_user_id) {
      setError('Select an analyst before saving a signature.');
      return;
    }
    if (!form.signature_data_url) {
      setError('Draw a signature before saving it.');
      return;
    }
    setSavingSignature(true);
    setError('');
    setSignatureMessage('');
    try {
      const response = await api.put('/api/v1/reports/air-sample/signature', {
        analyst_user_id: Number(form.analyst_user_id),
        signature_data_url: form.signature_data_url,
      });
      setPeople(current => current.map(person => (
        String(person.id) === String(form.analyst_user_id)
          ? { ...person, has_signature: true, signature_data_url: response.data.signature_data_url }
          : person
      )));
      setSignatureMessage('Signature saved. It will load automatically when this analyst is selected.');
    } catch (err) {
      setError(formatApiError(err, 'Failed to save signature'));
    } finally {
      setSavingSignature(false);
    }
  };

  const saveDraft = async () => {
    setBusy(true); setError('');
    try {
      const required = [
        [form.project_id, 'Select a project.', 0],
        [form.report_date, 'Enter a report date.', 0],
        [form.formatted_address, 'Enter or select a project address.', 0],
        [form.technician_name, 'Select a technician.', 0],
        [form.analyst_user_id, 'Select an analyst.', 3],
        [form.analyzed_date, 'Enter the analyzed date.', 3],
        [form.report_kind !== 'personal' || form.worker_name?.trim(), 'Enter the worker/person name for a personal report.', 0],
      ];
      const missing = required.find(([value]) => !value);
      if (missing) {
        setStep(missing[2]);
        setError(missing[1]);
        return;
      }

      const incompleteSample = form.samples.findIndex(sample => {
        const commonMissing = !sample.sample_number?.trim() || !sample.description?.trim() || !sample.sample_date;
        if (commonMissing) return true;
        if (sample.is_blank) return sample.fibers === '' || sample.fields === '' || Number(sample.fields) <= 0;
        if (sample.status === 'rejected') return !sample.reject_note?.trim();
        if (sample.status !== 'normal') return false;
        return !sample.start || !sample.end || sample.flow_rate === '' || sample.fibers === ''
          || sample.fields === '' || Number(sample.flow_rate) <= 0 || Number(sample.fields) <= 0;
      });
      if (incompleteSample >= 0) {
        setStep(form.samples[incompleteSample].is_blank ? 2 : 1);
        setError(`Complete all required fields for sample row ${incompleteSample + 1}.`);
        return;
      }

      const payload = {...form, project_id:Number(form.project_id), analyst_user_id:Number(form.analyst_user_id), technician_user_id:form.technician_user_id ? Number(form.technician_user_id) : null,
        samples: form.samples.map(s => ({...s, flow_rate:s.flow_rate === '' ? null:Number(s.flow_rate), fibers:s.fibers === '' ? null:Number(s.fibers), fields:s.fields === '' ? null:Number(s.fields), blank_type:s.is_blank?s.blank_type:null}))};
      const response = reportId
        ? await api.put(`/api/v1/reports/${reportId}/air-sample`, payload)
        : await api.post('/api/v1/reports/air-sample/drafts', payload);
      setReportId(String(response.data.id)); setStep(4);
      const pdf = await api.get(`/api/v1/reports/${response.data.id}/download`, {responseType:'blob'});
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
      setPdfUrl(URL.createObjectURL(new Blob([pdf.data], {type:'application/pdf'})));
    } catch (err) {
      setError(formatApiError(err, 'Failed to save draft'));
    } finally { setBusy(false); }
  };
  const finalize = async () => {
    try { await api.post(`/api/v1/reports/${reportId}/finalize`); navigate(`/reports/${reportId}`); }
    catch (err) { setError(formatApiError(err, 'Failed to finalize report')); }
  };

  const input = "mt-1 w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2";
  const steps = ['Report', 'Samples', 'Blanks', 'Analyst', 'Preview'];
  return <div className="max-w-7xl mx-auto p-4 md:p-6 text-gray-900 dark:text-gray-100">
    <div className="flex flex-wrap justify-between gap-3 mb-5"><div><h1 className="text-2xl font-bold">{reportId?'Edit':'Create'} Air Sample Report</h1><p className="text-sm text-gray-600 dark:text-gray-400">Editable draft · Excel-style PDF</p></div><button onClick={() => navigate(-1)} className="px-4 py-2 rounded border">Back</button></div>
    <div className="grid grid-cols-5 gap-2 mb-6">{steps.map((name,i)=><button key={name} onClick={()=>changeStep(i)} className={`py-2 rounded text-sm ${step===i?'bg-blue-600 text-white':'bg-gray-200 dark:bg-gray-700'}`}>{i+1}. {name}</button>)}</div>
    {error && <div className="mb-4 p-3 rounded bg-red-100 text-red-800 whitespace-pre-line">{error}</div>}
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-5">
      {step===0 && <div className="grid md:grid-cols-2 gap-4">
        <label>Project<select className={input} value={form.project_id} onChange={e=>set('project_id',e.target.value)}><option value="">Select project</option>{projects.map(p=><option key={p.id} value={p.id} disabled={!p.company_id}>{p.name}{!p.company_id ? ' (assign a client company first)' : ''}</option>)}</select></label>
        <label>Report type<select className={input} value={form.report_kind} onChange={e=>set('report_kind',e.target.value)}><option value="area">Area Air Sample</option><option value="clearance">Clearance Air Sample</option><option value="personal">Personal Air Sample</option></select></label>
        <label>Report date<input className={input} type="date" value={form.report_date} onChange={e=>set('report_date',e.target.value)}/></label>
        <label>Saved project address<select className={input} onChange={e=>chooseAddress(e.target.value)} defaultValue=""><option value="">{addresses.length ? 'Choose saved address' : 'No saved project addresses'}</option>{addresses.map(a=><option key={a.id} value={a.id}>{a.formatted_address || a.address_line1}</option>)}</select></label>
        <div className="md:col-span-2">
          <AddressInput value={addressValue} onChange={updateAddress} required showLocationName={false} allowManualEntry />
          <p className="mt-1 text-xs text-gray-500">Select a Google Places result. Manual entry is available if Google Maps cannot load.</p>
        </div>
        <label>Location / unit (optional)<input className={input} value={form.location_label} onChange={e=>set('location_label',e.target.value)}/></label>
        <label>Technician<select className={input} value={form.technician_user_id||''} onChange={e=>choosePerson('technician',e.target.value)}><option value="">Select technician</option>{people.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
        {form.report_kind==='personal' && <label>Worker / person<input className={input} value={form.worker_name} onChange={e=>set('worker_name',e.target.value)}/></label>}
        <label>Analytical procedure<input className={input} value={form.analytical_procedure} onChange={e=>set('analytical_procedure',e.target.value)}/></label>
        <label className="md:col-span-2">Additional project information<input className={input} value={form.project_additional_info} onChange={e=>set('project_additional_info',e.target.value)}/></label>
      </div>}
      {(step===1||step===2) && <div>
        <div className="flex justify-between mb-4"><h2 className="font-semibold">{step===1?'Samples':'Blank Samples'}</h2><button className="px-3 py-2 bg-blue-600 text-white rounded" onClick={()=>addSample(step===2)}>Add {step===2?'Blank':'Sample'}</button></div>
        <div className="space-y-4">{rows.map((s,i)=>s.is_blank===(step===2) && <div key={i} className="border rounded p-4 grid md:grid-cols-4 gap-3">
          <label>Sample #<input className={input} value={s.sample_number} onChange={e=>updateSample(i,'sample_number',e.target.value)}/></label>
          <label>Description<input className={input} value={s.description} onChange={e=>updateSample(i,'description',e.target.value)}/></label>
          <label>Date<input className={input} type="date" value={s.sample_date} onChange={e=>updateSample(i,'sample_date',e.target.value)}/></label>
          {s.is_blank?<label>Blank type<select className={input} value={s.blank_type} disabled={form.samples.filter(x=>x.is_blank&&x.blank_type===s.blank_type).length<=1} onChange={e=>{updateSample(i,'blank_type',e.target.value);updateSample(i,'description',e.target.value)}}><option>Field Blank</option><option>Lab Blank</option></select></label>:<label>Status<select className={input} value={s.status} onChange={e=>updateSample(i,'status',e.target.value)}><option value="normal">Normal</option><option value="overload">Overload</option><option value="damaged">Damaged</option><option value="rejected">Rejected</option></select></label>}
          {!s.is_blank && <><label>Start (24-hour)<input className={input} type="time" value={s.start} onChange={e=>updateSample(i,'start',e.target.value)}/></label><label>End (24-hour)<input className={input} type="time" value={s.end} onChange={e=>updateSample(i,'end',e.target.value)}/></label><label>Flow rate (L/min)<input className={input} type="number" min="0" step="0.01" value={s.flow_rate} onChange={e=>updateSample(i,'flow_rate',e.target.value)}/></label></>}
          {s.status==='rejected'?<label>Rejection reason<input className={input} value={s.reject_note} onChange={e=>updateSample(i,'reject_note',e.target.value)}/></label>:<><label>Fibers<input className={input} type="number" min="0" step="0.1" value={s.fibers} onChange={e=>updateSample(i,'fibers',e.target.value)}/></label><label>Fields<input className={input} type="number" min="1" value={s.fields} onChange={e=>updateSample(i,'fields',e.target.value)}/></label></>}
          {!s.is_blank&&s.status==='normal'&&<><label>Total minutes<input className={`${input} bg-gray-100`} readOnly value={s.total_minutes??''}/></label><label>Volume (L)<input className={`${input} bg-gray-100`} readOnly value={s.volume?.toFixed(2)||''}/></label><label>Fiber density<input className={`${input} bg-gray-100`} readOnly value={s.fiber_density?.toFixed(4)||''}/></label><label>Fiber concentration<input className={`${input} bg-gray-100`} readOnly value={s.fiber_concentration?.toFixed(4)||''}/></label></>}
          {!s.is_blank && <button type="button" className="inline-flex w-fit items-center rounded border border-blue-300 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50" onClick={()=>addSample(false,s.description)}>Add with same description</button>}
          <button type="button" className="inline-flex w-fit items-center rounded border border-red-300 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50" onClick={()=>removeSample(i)}>Remove sample</button>
        </div>)}</div>
        {form.report_kind==='personal'&&step===1&&<div className="mt-4 p-3 bg-gray-200 dark:bg-gray-700 font-semibold text-center">Time Weighted Average: {twa.toFixed(4)} f/cc</div>}
      </div>}
      {step===3 && <div className="grid md:grid-cols-2 gap-5">
        <label>Analyzed by<select className={input} value={form.analyst_user_id} onChange={e=>choosePerson('analyst',e.target.value)}><option value="">Select analyst</option>{analysts.map(p=><option key={p.id} value={p.id}>{p.name}{p.has_signature?' (saved signature)':''}</option>)}</select></label>
        <label>Analyzed date<input className={input} type="date" value={form.analyzed_date} onChange={e=>set('analyzed_date',e.target.value)}/></label>
        <div className="md:col-span-2 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <h2 className="font-semibold mb-2">Saved signature</h2>
          {selectedAnalyst?.signature_data_url ? (
            <div className="w-full max-w-xl h-32 bg-white border rounded flex items-center justify-center p-3">
              <img src={selectedAnalyst.signature_data_url} alt={`${selectedAnalyst.name} saved signature`} className="max-w-full max-h-full object-contain" />
            </div>
          ) : (
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {selectedAnalyst ? `${selectedAnalyst.name} does not have a saved signature.` : 'Select an analyst to view their saved signature.'}
            </p>
          )}
        </div>
        <div className="md:col-span-2">
          <p className="mb-2">The selected analyst's saved signature loads into the pad automatically. Draw or edit it, then save it for future reports.</p>
          <SignatureCanvas value={form.signature_data_url} onChange={v=>{set('signature_data_url',v);setSignatureMessage('')}}/>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button type="button" disabled={savingSignature || !form.signature_data_url || !form.analyst_user_id} onClick={saveSignature} className="px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-50">
              {savingSignature ? 'Saving…' : 'Save Signature'}
            </button>
            {signatureMessage && <span className="text-sm text-green-700 dark:text-green-400">{signatureMessage}</span>}
          </div>
        </div>
        <label className="md:col-span-2">Internal notes<textarea className={input} rows="3" value={form.notes} onChange={e=>set('notes',e.target.value)}/></label>
      </div>}
      {step===4 && <div>{pdfUrl?<iframe title="Draft report PDF" src={pdfUrl} className="w-full h-[70vh] border rounded"/>:<p>Save the draft to generate its PDF preview.</p>}</div>}
      <div className="flex justify-between mt-6 pt-4 border-t">
        <button disabled={step===0} onClick={()=>changeStep(Math.max(0,step-1))} className="px-4 py-2 rounded border disabled:opacity-40">Previous</button>
        <div className="flex gap-2">{reportId&&<button onClick={()=>downloadPdf(api,`/api/v1/reports/${reportId}/download`,'air-sample-report.pdf')} className="px-4 py-2 rounded border">Download PDF</button>}{reportId&&<button onClick={finalize} className="px-4 py-2 rounded bg-green-600 text-white">Finalize</button>}<button disabled={busy} onClick={step<3?goToNextStep:saveDraft} className="px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-50">{step<3?'Next':busy?'Saving…':reportId?'Update Draft':'Save Draft'}</button></div>
      </div>
    </div>
  </div>;
}
