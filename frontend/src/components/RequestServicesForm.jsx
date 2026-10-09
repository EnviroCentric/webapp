import React, { useState } from 'react';
export default function RequestServicesForm() {
  const [status, setStatus] = useState('');
  const [sending, setSending] = useState(false);
  async function submit(event) {
    event.preventDefault();
    const endpoint = import.meta.env.VITE_CONTACT_FORM_URL;
    if (!endpoint) { setStatus('Online submission is not available yet. Please call (714) 335-5973. Your entries are still here.'); return; }
    setSending(true); setStatus('');
    try {
      const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget))) });
      if (!response.ok) throw new Error('Submission failed');
      setStatus('Thank you. Your request has been submitted.');
    } catch { setStatus('We could not submit your request. Please try again or call (714) 335-5973.'); }
    finally { setSending(false); }
  }
  return <form id="request-services" className="request-form" onSubmit={submit}>
    <h2>Request our services</h2><p>Tell us about your project. Fields marked * are required.</p>
    <div className="form-name-row"><label>First name *<input name="firstName" autoComplete="given-name" required maxLength={100}/></label><label>Last name *<input name="lastName" autoComplete="family-name" required maxLength={100}/></label></div>
    <label>Email *<input name="email" type="email" autoComplete="email" required maxLength={254}/></label>
    <div className="form-phone-row"><label>Country code<select name="countryCode" defaultValue="+1"><option value="+1">United States / Canada (+1)</option><option value="+44">United Kingdom (+44)</option><option value="+61">Australia (+61)</option><option value="other">Other</option></select></label><label>Phone number<input name="phone" type="tel" autoComplete="tel-national" maxLength={40}/></label></div>
    <label>Details<textarea name="details" rows={5} maxLength={5000} placeholder="Please include a brief description of the reason you are contacting us."/></label>
    <fieldset><legend>I am a *</legend>{['Home Owner', 'Realtor', 'Restoration Company', 'Property Manager', 'Insurance Company', 'Other'].map(role => <label className="form-choice" key={role}><input type="radio" name="clientType" value={role} required/>{role}</label>)}</fieldset>
    <label>How did you hear about us? *<select name="referral" required defaultValue=""><option value="" disabled>Please select</option>{['Search engine', 'Referral', 'Social media', 'Returning client', 'Other'].map(value => <option key={value}>{value}</option>)}</select></label>
    <label className="form-choice"><input name="communicationsConsent" type="checkbox" value="yes"/>I agree to receive communications from Enviro-Centric about my request.</label>
    <button className="site-button" type="submit" disabled={sending}>{sending ? 'Submitting…' : 'Submit request'}</button><p role="status" aria-live="polite">{status}</p>
  </form>;
}
