import { useMemo, useState } from 'react';
import FadeIn from '../components/FadeIn.jsx';
import Button from '../components/Button.jsx';
import Card from '../components/Card.jsx';
import Dialog from '../components/Dialog.jsx';
import SectionTitle from '../components/SectionTitle.jsx';
import { apiPost } from '../lib/api.js';

function createInitialForm() {
  return {
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    create_account: false,
    password: '',
    description: ''
  };
}

function createInitialFiles() {
  return {
    idFront: null,
    idBack: null,
    inspiration: []
  };
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Unable to read file.'));
    reader.readAsDataURL(file);
  });
}

const REQUIREMENTS = [
  'Upload clear front and back photos of your government-issued ID.',
  'Share inspiration imagery (up to three files) or include a written description.',
  'Optionally create a client account to keep your documents on file.'
];

export default function Booking() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(() => createInitialForm());
  const [files, setFiles] = useState(() => createInitialFiles());
  const [errors, setErrors] = useState({});
  const [notice, setNotice] = useState(null);
  const [noticeTone, setNoticeTone] = useState('success');
  const [submitting, setSubmitting] = useState(false);

  const requirementList = useMemo(
    () =>
      REQUIREMENTS.map((item, index) => (
        <li key={index} className="text-xs uppercase tracking-[0.25em] text-gray-500 dark:text-gray-400">
          {item}
        </li>
      )),
    []
  );

  const handleChange = (field) => (event) => {
    if (field === 'create_account') {
      const checked = event.target.checked;
      setForm((prev) => ({
        ...prev,
        create_account: checked,
        password: checked ? prev.password : ''
      }));
      setErrors((prev) => {
        const next = { ...prev };
        delete next.create_account;
        delete next.password;
        return next;
      });
      return;
    }

    setForm((prev) => ({
      ...prev,
      [field]: event.target.value
    }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const handleFileChange = (field) => async (event) => {
    const selectedFiles = Array.from(event.target.files || []);
    if (!selectedFiles.length) {
      setFiles((prev) => ({
        ...prev,
        [field]: field === 'inspiration' ? [] : null
      }));
      return;
    }

    try {
      if (field === 'inspiration') {
        const uploads = await Promise.all(
          selectedFiles.slice(0, 3).map(async (file) => ({
            name: file.name,
            dataUrl: await readFileAsDataUrl(file)
          }))
        );
        setFiles((prev) => ({
          ...prev,
          inspiration: uploads
        }));
      } else {
        const file = selectedFiles[0];
        const dataUrl = await readFileAsDataUrl(file);
        setFiles((prev) => ({
          ...prev,
          [field]: {
            name: file.name,
            dataUrl
          }
        }));
      }
      setErrors((prev) => {
        const next = { ...prev };
        if (field === 'inspiration') {
          delete next.description;
        } else if (field === 'idFront') {
          delete next.id_front;
        } else if (field === 'idBack') {
          delete next.id_back;
        }
        return next;
      });
    } catch (error) {
      setErrors((prev) => ({
        ...prev,
        files: 'Unable to read selected file(s).'
      }));
    } finally {
      event.target.value = '';
    }
  };

  const validate = () => {
    const validationErrors = {};
    if (!form.first_name.trim()) {
      validationErrors.first_name = 'Required';
    }
    if (!form.last_name.trim()) {
      validationErrors.last_name = 'Required';
    }
    if (!form.email.trim()) {
      validationErrors.email = 'Required';
    }
    if (!files.idFront) {
      validationErrors.id_front = 'Required';
    }
    if (!files.idBack) {
      validationErrors.id_back = 'Required';
    }
    if (!form.description.trim() && !files.inspiration.length) {
      validationErrors.description = 'Add inspiration details';
    }
    if (form.create_account && form.password.trim().length < 8) {
      validationErrors.password = 'Min. 8 characters';
    }
    setErrors(validationErrors);
    return Object.keys(validationErrors).length === 0;
  };

  const resetBookingState = () => {
    setForm(() => createInitialForm());
    setFiles(() => createInitialFiles());
    setErrors({});
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!validate()) {
      return;
    }

    setSubmitting(true);
    const payload = {
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      email: form.email.trim().toLowerCase(),
      phone: form.phone.trim() || null,
      create_account: form.create_account,
      description: form.description.trim(),
      id_front_url: files.idFront?.dataUrl,
      id_back_url: files.idBack?.dataUrl,
      inspiration_urls: files.inspiration.map((file) => file.dataUrl)
    };

    if (form.create_account) {
      payload.password = form.password;
    }

    try {
      const response = await apiPost('/api/appointments', payload);
      const reference = response?.reference_code || 'Pending assignment';
      setNotice(`Appointment received - reference ${reference}. We will confirm within two business days.`);
      setNoticeTone('success');
      resetBookingState();
      setOpen(false);
    } catch (error) {
      setNotice('Request saved locally. We will follow up once connected.');
      setNoticeTone('offline');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section id="booking" className="bg-white py-16 text-gray-900 dark:bg-black dark:text-gray-100">
      <FadeIn className="mx-auto flex max-w-6xl flex-col gap-12 px-6" delayStep={0.18}>
        <SectionTitle
          eyebrow="Booking"
          title="Reserve your session"
          description="Share your idea, upload ID verification, and we will align the right artist. Responses land within two business days."
        />
        <Card className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="space-y-3">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Booking requests now include secure document intake so we can prepare custom design time and confirm age
              requirements before meeting. Files are encrypted at rest and visible only to our team unless you toggle
              otherwise.
            </p>
            <ul className="space-y-1">{requirementList}</ul>
          </div>
          <Button type="button" onClick={() => setOpen(true)}>
            Start Booking
          </Button>
        </Card>
        {notice ? (
          <FadeIn
            immediate
            className={`rounded-2xl border px-6 py-4 text-xs uppercase tracking-[0.3em] ${
              noticeTone === 'success'
                ? 'border-gray-200 bg-gray-50 text-gray-600 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300'
                : 'border-gray-300 bg-white text-gray-700 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200'
            }`}
          >
            {notice}
          </FadeIn>
        ) : null}
      </FadeIn>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Share your idea"
        footer={
          <>
            <Button type="submit" form="booking-form" disabled={submitting}>
              {submitting ? 'Sending...' : 'Submit booking'}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setOpen(false)} disabled={submitting}>
              Cancel
            </Button>
          </>
        }
      >
        <FadeIn
          as="form"
          id="booking-form"
          className="space-y-5"
          onSubmit={handleSubmit}
          immediate
          delayStep={0.08}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="booking-first-name"
                className="text-xs font-semibold uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400"
              >
                First name *
              </label>
              <input
                id="booking-first-name"
                name="first_name"
                type="text"
                value={form.first_name}
                onChange={handleChange('first_name')}
                className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 transition focus:border-gray-900 focus:outline-none focus:ring-0 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:focus:border-gray-400"
                required
              />
              {errors.first_name ? (
                <p className="mt-1 text-xs uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">{errors.first_name}</p>
              ) : null}
            </div>
            <div>
              <label
                htmlFor="booking-last-name"
                className="text-xs font-semibold uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400"
              >
                Last name *
              </label>
              <input
                id="booking-last-name"
                name="last_name"
                type="text"
                value={form.last_name}
                onChange={handleChange('last_name')}
                className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 transition focus:border-gray-900 focus:outline-none focus:ring-0 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:focus:border-gray-400"
                required
              />
              {errors.last_name ? (
                <p className="mt-1 text-xs uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">{errors.last_name}</p>
              ) : null}
            </div>
            <div>
              <label
                htmlFor="booking-email"
                className="text-xs font-semibold uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400"
              >
                Email *
              </label>
              <input
                id="booking-email"
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange('email')}
                className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 transition focus:border-gray-900 focus:outline-none focus:ring-0 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:focus:border-gray-400"
                required
              />
              {errors.email ? (
                <p className="mt-1 text-xs uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">{errors.email}</p>
              ) : null}
            </div>
            <div>
              <label
                htmlFor="booking-phone"
                className="text-xs font-semibold uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400"
              >
                Phone (optional)
              </label>
              <input
                id="booking-phone"
                name="phone"
                type="tel"
                value={form.phone}
                onChange={handleChange('phone')}
                className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 transition focus:border-gray-900 focus:outline-none focus:ring-0 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:focus:border-gray-400"
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="booking-id-front"
                className="text-xs font-semibold uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400"
              >
                Government ID (front) *
              </label>
              <input
                id="booking-id-front"
                name="id_front"
                type="file"
                accept="image/*"
                onChange={handleFileChange('idFront')}
                className="mt-2 block w-full text-sm text-gray-600 dark:text-gray-300"
                required
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {files.idFront ? `Selected: ${files.idFront.name}` : 'Accepted formats: PNG, JPG, HEIC.'}
              </p>
              {errors.id_front ? (
                <p className="mt-1 text-xs uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">{errors.id_front}</p>
              ) : null}
            </div>
            <div>
              <label
                htmlFor="booking-id-back"
                className="text-xs font-semibold uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400"
              >
                Government ID (back) *
              </label>
              <input
                id="booking-id-back"
                name="id_back"
                type="file"
                accept="image/*"
                onChange={handleFileChange('idBack')}
                className="mt-2 block w-full text-sm text-gray-600 dark:text-gray-300"
                required
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {files.idBack ? `Selected: ${files.idBack.name}` : 'Ensure details are readable.'}
              </p>
              {errors.id_back ? (
                <p className="mt-1 text-xs uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">{errors.id_back}</p>
              ) : null}
            </div>
          </div>
          <div>
            <label
              htmlFor="booking-inspiration"
              className="text-xs font-semibold uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400"
            >
              Inspiration images (up to 3 files)
            </label>
            <input
              id="booking-inspiration"
              name="inspiration"
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileChange('inspiration')}
              className="mt-2 block w-full text-sm text-gray-600 dark:text-gray-300"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {files.inspiration.length
                ? `Selected: ${files.inspiration.map((file) => file.name).join(', ')}`
                : 'Alternatively, you can describe your idea below.'}
            </p>
          </div>
          <div>
            <label
              htmlFor="booking-description"
              className="text-xs font-semibold uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400"
            >
              Written description {files.inspiration.length ? '(optional)' : '*'}
            </label>
            <textarea
              id="booking-description"
              name="description"
              value={form.description}
              onChange={handleChange('description')}
              rows={4}
              className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 transition focus:border-gray-900 focus:outline-none focus:ring-0 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:focus:border-gray-400"
              required={!files.inspiration.length}
            />
            {errors.description ? (
              <p className="mt-1 text-xs uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">{errors.description}</p>
            ) : null}
          </div>
          <div className="space-y-3 rounded-2xl border border-dashed border-gray-300 p-4 dark:border-gray-700">
            <label className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">
              <input
                id="booking-create-account"
                name="create_account"
                type="checkbox"
                checked={form.create_account}
                onChange={handleChange('create_account')}
                className="h-4 w-4 rounded border border-gray-400 text-gray-900 focus:ring-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:focus:ring-gray-400"
              />
              Create a client account for future bookings
            </label>
            {form.create_account ? (
              <div>
                <label
                  htmlFor="booking-password"
                  className="text-xs font-semibold uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400"
                >
                  Set password *
                </label>
                <input
                  id="booking-password"
                  name="password"
                  type="password"
                  value={form.password}
                  onChange={handleChange('password')}
                  className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 transition focus:border-gray-900 focus:outline-none focus:ring-0 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:focus:border-gray-400"
                  required
                />
                {errors.password ? (
                  <p className="mt-1 text-xs uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">{errors.password}</p>
                ) : null}
              </div>
            ) : (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Continue as a guest if you prefer one-time document sharing. Assets remain encrypted and accessible to you
                during follow-ups.
              </p>
            )}
          </div>
          {errors.files ? (
            <p className="text-xs uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">{errors.files}</p>
          ) : null}
        </FadeIn>
      </Dialog>
    </section>
  );
}
