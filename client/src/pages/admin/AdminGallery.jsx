import { useEffect, useMemo, useRef, useState } from 'react';
import Button from '../../components/Button.jsx';
import Card from '../../components/Card.jsx';
import ConfirmDialog from '../../components/ConfirmDialog.jsx';
import Dialog from '../../components/Dialog.jsx';
import SectionTitle from '../../components/SectionTitle.jsx';
import { resolveApiUrl } from '../../lib/api.js';
import { useAdminDashboard } from './AdminDashboardContext.jsx';
import {
  getClientSideUploadError,
  getUploadErrorMessage,
  validateImageBeforeUpload
} from '../../lib/uploadValidation.js';

// ─── Constants ────────────────────────────────────────────────────────────────

const TABS = [
  { key: 'photos', label: 'Photos' },
  { key: 'placements', label: 'Placements' },
  { key: 'categories', label: 'Categories' }
];

const PLACEMENT_SECTIONS = {
  our_story: {
    key: 'our_story',
    label: 'Our Story',
    description:
      'Four photo panels displayed in the "Our Story" section of the homepage. Each slot has a custom label shown over the photo.',
    slotCount: 4,
    hasLabel: true
  },
  homepage_taste: {
    key: 'homepage_taste',
    label: 'A Taste of the Experience',
    description: 'Six photos shown in the homepage preview gallery grid.',
    slotCount: 6,
    hasLabel: false
  }
};

const INPUT_CLS =
  'w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-0';
const LABEL_CLS = 'block text-[10px] font-semibold uppercase tracking-[0.3em] text-gray-500';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildEmptySlots(count) {
  return Array.from({ length: count }, (_, i) => ({
    display_order: i + 1,
    gallery_item_id: '',
    slot_label: ''
  }));
}

// ─── Placement slot card (unchanged logic, improved visual) ───────────────────

function PlacementSlotCard({ slot, index, hasLabel, galleryItems, resolveUrl, onChange }) {
  const selectedItem = slot.gallery_item_id
    ? galleryItems.find((item) => String(item.id) === String(slot.gallery_item_id))
    : null;
  const thumbUrl = selectedItem ? resolveUrl(selectedItem.image_url) : null;
  const slotBaseId = `slot-${slot.display_order}`;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 space-y-3">
      <div className="flex items-start gap-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-900 text-[11px] font-semibold text-white">
          {slot.display_order}
        </span>
        <div className="flex-1">
          {thumbUrl ? (
            <img
              src={thumbUrl}
              alt={selectedItem?.alt || 'Selected photo'}
              className="h-28 w-full rounded-xl object-cover"
            />
          ) : (
            <div className="flex h-28 w-full items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50">
              <span className="text-[10px] uppercase tracking-[0.3em] text-gray-400">No photo</span>
            </div>
          )}
        </div>
      </div>

      <div>
        <label htmlFor={`${slotBaseId}-photo`} className={LABEL_CLS}>
          Photo
        </label>
        <select
          id={`${slotBaseId}-photo`}
          value={slot.gallery_item_id}
          onChange={(e) => onChange(index, 'gallery_item_id', e.target.value)}
          className={`mt-1 ${INPUT_CLS}`}
        >
          <option value="">— Select a photo —</option>
          {galleryItems.map((item) => (
            <option key={item.id} value={String(item.id)}>
              {item.alt}
              {item.category ? ` (${item.category.name})` : ''}
              {!item.is_published ? ' [draft]' : ''}
            </option>
          ))}
        </select>
      </div>

      {hasLabel && (
        <div>
          <label htmlFor={`${slotBaseId}-label`} className={LABEL_CLS}>
            Slot label
          </label>
          <input
            id={`${slotBaseId}-label`}
            type="text"
            placeholder='e.g. "The Room"'
            value={slot.slot_label}
            onChange={(e) => onChange(index, 'slot_label', e.target.value)}
            className={`mt-1 ${INPUT_CLS}`}
          />
        </div>
      )}

      {slot.gallery_item_id && (
        <button
          type="button"
          onClick={() => onChange(index, 'gallery_item_id', '')}
          className="text-[10px] uppercase tracking-[0.3em] text-gray-400 hover:text-rose-600 transition"
        >
          Clear slot
        </button>
      )}
    </div>
  );
}

// ─── Placement section panel ──────────────────────────────────────────────────

function PlacementSectionPanel({ sectionConfig, currentPlacements, galleryItems, resolveUrl, onSave }) {
  const { key, label, description, slotCount, hasLabel } = sectionConfig;
  const [slots, setSlots] = useState(() => buildEmptySlots(slotCount));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const draft = buildEmptySlots(slotCount);
    currentPlacements.forEach((p) => {
      const idx = p.display_order - 1;
      if (idx >= 0 && idx < slotCount) {
        draft[idx] = {
          display_order: p.display_order,
          gallery_item_id: p.gallery_item ? String(p.gallery_item.id) : '',
          slot_label: p.slot_label || ''
        };
      }
    });
    setSlots(draft);
  }, [currentPlacements, slotCount]);

  const handleSlotChange = (index, field, value) => {
    setSlots((prev) => prev.map((slot, i) => (i === index ? { ...slot, [field]: value } : slot)));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const filledSlots = slots
        .filter((s) => s.gallery_item_id !== '')
        .map((s) => ({
          display_order: s.display_order,
          gallery_item_id: Number(s.gallery_item_id),
          slot_label: s.slot_label.trim() || null
        }));
      await onSave(key, filledSlots);
    } finally {
      setSaving(false);
    }
  };

  const gridClass =
    slotCount === 4 ? 'grid gap-3 sm:grid-cols-2' : 'grid gap-3 sm:grid-cols-2 lg:grid-cols-3';

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">{description}</p>
      <div className={gridClass}>
        {slots.map((slot, idx) => (
          <PlacementSlotCard
            key={slot.display_order}
            slot={slot}
            index={idx}
            hasLabel={hasLabel}
            galleryItems={galleryItems}
            resolveUrl={resolveUrl}
            onChange={handleSlotChange}
          />
        ))}
      </div>
      <div className="flex items-center gap-4">
        <Button type="button" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : `Save ${label} placements`}
        </Button>
        <span className="text-[10px] uppercase tracking-[0.3em] text-gray-400">
          {slots.filter((s) => s.gallery_item_id).length} / {slotCount} slots filled
        </span>
      </div>
    </div>
  );
}

// ─── Gallery photo card (view mode) ──────────────────────────────────────────

function GalleryPhotoCard({ item, onEdit, onDelete }) {
  const imageUrl = resolveApiUrl(item.image_url);
  return (
    <div className="group flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white transition-shadow duration-200 hover:shadow-md">
      {/* Thumbnail */}
      <div className="relative aspect-[4/3] overflow-hidden bg-gray-100">
        <img
          src={imageUrl}
          alt={item.alt}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          loading="lazy"
        />
        {!item.is_published && (
          <span className="absolute left-2 top-2 rounded-full bg-amber-500/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-white backdrop-blur-sm">
            Draft
          </span>
        )}
      </div>

      {/* Info */}
      <div className="flex flex-1 flex-col gap-1 px-3 pt-2 pb-1">
        <p className="truncate text-xs font-medium text-gray-900" title={item.alt}>
          {item.alt}
        </p>
        <p className="truncate text-[10px] uppercase tracking-[0.25em] text-gray-400">
          {item.category?.name ?? 'Uncategorised'}
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 border-t border-gray-100 px-3 py-2">
        <button
          type="button"
          onClick={() => onEdit(item)}
          className="text-[10px] font-semibold uppercase tracking-[0.3em] text-gray-500 transition hover:text-gray-900"
        >
          Edit
        </button>
        <span className="text-gray-200" aria-hidden>|</span>
        <button
          type="button"
          onClick={() => onDelete(item)}
          className="text-[10px] font-semibold uppercase tracking-[0.3em] text-gray-400 transition hover:text-rose-600"
        >
          Delete
        </button>
        <a
          href={imageUrl}
          target="_blank"
          rel="noreferrer"
          className="ml-auto text-[10px] font-semibold uppercase tracking-[0.3em] text-gray-300 transition hover:text-gray-600"
          title="Open full image"
        >
          ↗
        </a>
      </div>
    </div>
  );
}

// ─── Edit item dialog ─────────────────────────────────────────────────────────

function EditItemDialog({ item, categories, onSave, onDelete, onClose }) {
  const [draft, setDraft] = useState({
    category_id: item.category?.id ? String(item.category.id) : '',
    alt: item.alt || '',
    caption: item.caption || '',
    is_published: Boolean(item.is_published)
  });
  const [saving, setSaving] = useState(false);
  const altRef = useRef(null);

  useEffect(() => {
    altRef.current?.focus();
  }, []);

  const handleChange = (field, value) => {
    setDraft((prev) => ({ ...prev, [field]: field === 'is_published' ? Boolean(value) : value }));
  };

  const handleSave = async () => {
    if (!draft.alt.trim()) return;
    setSaving(true);
    try {
      await onSave(item.id, {
        category_id: draft.category_id ? Number(draft.category_id) : undefined,
        alt: draft.alt.trim(),
        caption: draft.caption.trim() || null,
        is_published: draft.is_published
      });
      onClose();
    } catch {
      // error surfaced via notice in context
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open
      onClose={saving ? undefined : onClose}
      title="Edit photo"
      footer={[
        <Button key="delete" type="button" variant="ghost" onClick={() => onDelete(item)} disabled={saving}>
          Delete
        </Button>,
        <Button key="cancel" type="button" variant="ghost" onClick={onClose} disabled={saving}>
          Cancel
        </Button>,
        <Button key="save" type="button" onClick={handleSave} disabled={saving || !draft.alt.trim()}>
          {saving ? 'Saving…' : 'Save changes'}
        </Button>
      ]}
    >
      {/* Preview */}
      <img
        src={resolveApiUrl(item.image_url)}
        alt={item.alt}
        className="w-full rounded-xl object-cover"
        style={{ maxHeight: '180px' }}
      />

      <div className="space-y-4">
        {/* Alt text */}
        <div>
          <label htmlFor="edit-item-alt" className={LABEL_CLS}>
            Alt text <span className="text-rose-500">*</span>
          </label>
          <input
            ref={altRef}
            id="edit-item-alt"
            type="text"
            value={draft.alt}
            onChange={(e) => handleChange('alt', e.target.value)}
            className={`mt-1 ${INPUT_CLS}`}
            placeholder="Describe the photo for accessibility"
          />
        </div>

        {/* Caption */}
        <div>
          <label htmlFor="edit-item-caption" className={LABEL_CLS}>
            Caption
          </label>
          <textarea
            id="edit-item-caption"
            rows={2}
            value={draft.caption}
            onChange={(e) => handleChange('caption', e.target.value)}
            className={`mt-1 ${INPUT_CLS} resize-none`}
            placeholder="Optional display caption"
          />
        </div>

        {/* Category + Published row */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="edit-item-category" className={LABEL_CLS}>
              Category
            </label>
            <select
              id="edit-item-category"
              value={draft.category_id}
              onChange={(e) => handleChange('category_id', e.target.value)}
              className={`mt-1 ${INPUT_CLS}`}
            >
              <option value="">Uncategorised</option>
              {categories.map((c) => (
                <option key={c.id} value={String(c.id)}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col justify-end pb-1">
            <label htmlFor="edit-item-published" className="flex cursor-pointer items-center gap-2 select-none">
              <div className="relative">
                <input
                  id="edit-item-published"
                  type="checkbox"
                  className="sr-only peer"
                  checked={draft.is_published}
                  onChange={(e) => handleChange('is_published', e.target.checked)}
                />
                <div className="h-5 w-9 rounded-full border border-gray-300 bg-gray-200 transition peer-checked:border-gray-900 peer-checked:bg-gray-900" />
                <div className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition peer-checked:translate-x-4" />
              </div>
              <span className="text-[10px] font-semibold uppercase tracking-[0.3em] text-gray-500 peer-checked:text-gray-900">
                {draft.is_published ? 'Live' : 'Draft'}
              </span>
            </label>
          </div>
        </div>

        {/* Upload date */}
        {item.created_at && (
          <p className="text-[10px] text-gray-400">
            Uploaded {new Date(item.created_at).toLocaleDateString()}
          </p>
        )}
      </div>
    </Dialog>
  );
}

// ─── Upload dialog ────────────────────────────────────────────────────────────

const INITIAL_UPLOAD = {
  file: null,
  previewUrl: '',
  alt: '',
  caption: '',
  category_id: '',
  uploaded_by_admin_id: '',
  is_published: true
};

function UploadDialog({ categories, admins, currentAdmin, onUpload, onClose }) {
  const [form, setForm] = useState(() => ({
    ...INITIAL_UPLOAD,
    category_id: categories[0]?.id ? String(categories[0].id) : '',
    uploaded_by_admin_id: currentAdmin?.id ? String(currentAdmin.id) : ''
  }));
  const [uploadError, setUploadError] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  // Revoke object URL on unmount
  useEffect(() => {
    return () => {
      if (form.previewUrl) URL.revokeObjectURL(form.previewUrl);
    };
  }, [form.previewUrl]);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const validation = validateImageBeforeUpload(file);
    if (!validation.isValid) {
      setUploadError(getClientSideUploadError(validation.reason));
      return;
    }
    setUploadError(null);
    setForm((prev) => {
      if (prev.previewUrl) URL.revokeObjectURL(prev.previewUrl);
      return { ...prev, file, previewUrl: URL.createObjectURL(file) };
    });
  };

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: field === 'is_published' ? Boolean(value) : value }));
  };

  const canSubmit = form.file && form.alt.trim() && form.category_id && !uploading;

  const handleUpload = async () => {
    if (!canSubmit) return;
    setUploading(true);
    try {
      await onUpload({
        file: form.file,
        alt: form.alt.trim(),
        caption: form.caption.trim() || null,
        category_id: Number(form.category_id),
        uploaded_by_admin_id: form.uploaded_by_admin_id
          ? Number(form.uploaded_by_admin_id)
          : currentAdmin?.id,
        is_published: form.is_published
      });
      onClose();
    } catch (err) {
      const msg = getUploadErrorMessage(err);
      setUploadError(msg || 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog
      open
      onClose={uploading ? undefined : onClose}
      title="Upload new photo"
      footer={[
        <Button key="cancel" type="button" variant="ghost" onClick={onClose} disabled={uploading}>
          Cancel
        </Button>,
        <Button key="upload" type="button" onClick={handleUpload} disabled={!canSubmit}>
          {uploading ? 'Uploading…' : 'Upload photo'}
        </Button>
      ]}
    >
      <div className="space-y-4">
        {/* File picker */}
        <div>
          <label className={LABEL_CLS}>Image file</label>
          <div
            onClick={() => fileInputRef.current?.click()}
            className="mt-1 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-center transition hover:border-gray-400 hover:bg-gray-100"
          >
            {form.previewUrl ? (
              <img
                src={form.previewUrl}
                alt="Preview"
                className="mb-3 max-h-40 rounded-lg object-contain"
              />
            ) : (
              <svg
                className="mb-2 h-8 w-8 text-gray-300"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            )}
            <span className="text-xs text-gray-500">
              {form.file ? form.file.name : 'Click to choose a photo'}
            </span>
            <span className="mt-0.5 text-[10px] text-gray-400">JPG, PNG or WebP · max 10 MB</span>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={handleFileChange}
          />
          {uploadError && (
            <p className="mt-1.5 text-xs uppercase tracking-[0.2em] text-rose-600">{uploadError}</p>
          )}
        </div>

        {/* Alt text */}
        <div>
          <label htmlFor="upload-alt" className={LABEL_CLS}>
            Alt text <span className="text-rose-500">*</span>
          </label>
          <input
            id="upload-alt"
            type="text"
            value={form.alt}
            onChange={(e) => handleChange('alt', e.target.value)}
            placeholder="Describe the photo for accessibility"
            className={`mt-1 ${INPUT_CLS}`}
          />
        </div>

        {/* Caption */}
        <div>
          <label htmlFor="upload-caption" className={LABEL_CLS}>
            Caption
          </label>
          <input
            id="upload-caption"
            type="text"
            value={form.caption}
            onChange={(e) => handleChange('caption', e.target.value)}
            placeholder="Optional display caption"
            className={`mt-1 ${INPUT_CLS}`}
          />
        </div>

        {/* Category + Admin row */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="upload-category" className={LABEL_CLS}>
              Category <span className="text-rose-500">*</span>
            </label>
            <select
              id="upload-category"
              value={form.category_id}
              onChange={(e) => handleChange('category_id', e.target.value)}
              className={`mt-1 ${INPUT_CLS}`}
            >
              <option value="">Select category</option>
              {categories.map((c) => (
                <option key={c.id} value={String(c.id)}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="upload-uploader" className={LABEL_CLS}>
              Uploaded by
            </label>
            <select
              id="upload-uploader"
              value={form.uploaded_by_admin_id}
              onChange={(e) => handleChange('uploaded_by_admin_id', e.target.value)}
              className={`mt-1 ${INPUT_CLS}`}
            >
              {admins.map((a) => (
                <option key={a.id} value={String(a.id)}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Published toggle */}
        <label htmlFor="upload-published" className="flex cursor-pointer items-center gap-3 select-none">
          <div className="relative">
            <input
              id="upload-published"
              type="checkbox"
              className="sr-only peer"
              checked={form.is_published}
              onChange={(e) => handleChange('is_published', e.target.checked)}
            />
            <div className="h-5 w-9 rounded-full border border-gray-300 bg-gray-200 transition peer-checked:border-gray-900 peer-checked:bg-gray-900" />
            <div className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition peer-checked:translate-x-4" />
          </div>
          <span className="text-[10px] font-semibold uppercase tracking-[0.3em] text-gray-500">
            {form.is_published ? 'Publish immediately' : 'Save as draft'}
          </span>
        </label>
      </div>
    </Dialog>
  );
}

// ─── Edit category dialog ─────────────────────────────────────────────────────

function EditCategoryDialog({ category, onSave, onClose }) {
  const [draft, setDraft] = useState({
    name: category.name,
    description: category.description || '',
    is_active: Boolean(category.is_active)
  });
  const [saving, setSaving] = useState(false);
  const nameRef = useRef(null);

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  const handleChange = (field, value) => {
    setDraft((prev) => ({ ...prev, [field]: field === 'is_active' ? Boolean(value) : value }));
  };

  const handleSave = async () => {
    if (!draft.name.trim()) return;
    setSaving(true);
    try {
      await onSave(category.id, {
        name: draft.name.trim(),
        description: draft.description.trim() || null,
        is_active: draft.is_active
      });
      onClose();
    } catch {
      // error surfaced via notice
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open
      onClose={saving ? undefined : onClose}
      title="Edit category"
      footer={[
        <Button key="cancel" type="button" variant="ghost" onClick={onClose} disabled={saving}>
          Cancel
        </Button>,
        <Button key="save" type="button" onClick={handleSave} disabled={saving || !draft.name.trim()}>
          {saving ? 'Saving…' : 'Save changes'}
        </Button>
      ]}
    >
      <div className="space-y-4">
        <div>
          <label htmlFor="edit-cat-name" className={LABEL_CLS}>
            Name <span className="text-rose-500">*</span>
          </label>
          <input
            ref={nameRef}
            id="edit-cat-name"
            type="text"
            value={draft.name}
            onChange={(e) => handleChange('name', e.target.value)}
            className={`mt-1 ${INPUT_CLS}`}
          />
        </div>

        <div>
          <label htmlFor="edit-cat-description" className={LABEL_CLS}>
            Description
          </label>
          <input
            id="edit-cat-description"
            type="text"
            value={draft.description}
            onChange={(e) => handleChange('description', e.target.value)}
            placeholder="Optional description"
            className={`mt-1 ${INPUT_CLS}`}
          />
        </div>

        <label htmlFor="edit-cat-active" className="flex cursor-pointer items-center gap-3 select-none">
          <div className="relative">
            <input
              id="edit-cat-active"
              type="checkbox"
              className="sr-only peer"
              checked={draft.is_active}
              onChange={(e) => handleChange('is_active', e.target.checked)}
            />
            <div className="h-5 w-9 rounded-full border border-gray-300 bg-gray-200 transition peer-checked:border-gray-900 peer-checked:bg-gray-900" />
            <div className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition peer-checked:translate-x-4" />
          </div>
          <span className="text-[10px] font-semibold uppercase tracking-[0.3em] text-gray-500">
            {draft.is_active ? 'Active — visible on site' : 'Hidden — not shown publicly'}
          </span>
        </label>
      </div>
    </Dialog>
  );
}

// ─── Create category inline form ──────────────────────────────────────────────

const INITIAL_CATEGORY = { name: '', description: '', is_active: true };

function CreateCategoryForm({ onSubmit }) {
  const [form, setForm] = useState(INITIAL_CATEGORY);
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: field === 'is_active' ? Boolean(value) : value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSubmitting(true);
    try {
      await onSubmit({
        name: form.name.trim(),
        description: form.description.trim() || null,
        is_active: form.is_active
      });
      setForm(INITIAL_CATEGORY);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-4">
      <p className={`mb-3 ${LABEL_CLS}`}>New category</p>
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto_auto]">
        <input
          type="text"
          placeholder="Category name *"
          value={form.name}
          onChange={(e) => handleChange('name', e.target.value)}
          required
          className={INPUT_CLS}
        />
        <input
          type="text"
          placeholder="Description (optional)"
          value={form.description}
          onChange={(e) => handleChange('description', e.target.value)}
          className={INPUT_CLS}
        />
        <label className="flex cursor-pointer items-center gap-2 self-center whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.3em] text-gray-500 select-none">
          <input
            type="checkbox"
            checked={form.is_active}
            onChange={(e) => handleChange('is_active', e.target.checked)}
            className="h-4 w-4 rounded border border-gray-400"
          />
          Active
        </label>
        <Button type="submit" disabled={!form.name.trim() || submitting} className="self-start">
          {submitting ? 'Creating…' : 'Create'}
        </Button>
      </div>
    </form>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AdminGallery() {
  const {
    state: { categories, placements, galleryItems, galleryPagination, admins, currentAdmin },
    actions: {
      savePlacements,
      createCategory,
      updateCategory,
      deleteCategory,
      uploadMedia,
      createGalleryItem,
      updateGalleryItem,
      deleteGalleryItem,
      loadMoreGalleryItems
    }
  } = useAdminDashboard();

  const [activeTab, setActiveTab] = useState('photos');
  const [filterCategory, setFilterCategory] = useState('');

  // Dialog states
  const [uploadOpen, setUploadOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [editingCategory, setEditingCategory] = useState(null);

  // Confirmation dialog state
  const [confirmation, setConfirmation] = useState(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  // Sync editingItem with latest data (in case optimistic update changes the item)
  useEffect(() => {
    if (!editingItem) return;
    const latest = galleryItems.find((i) => i.id === editingItem.id);
    if (latest && latest !== editingItem) setEditingItem(latest);
  }, [galleryItems, editingItem]);

  // ── Derived ────────────────────────────────────────────────────────────────

  const filteredItems = useMemo(() => {
    if (!filterCategory) return galleryItems;
    return galleryItems.filter((item) => String(item.category?.id) === filterCategory);
  }, [galleryItems, filterCategory]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleUpload = async (payload) => {
    const upload = await uploadMedia(payload.file);
    await createGalleryItem({
      category_id: payload.category_id,
      uploaded_by_admin_id: payload.uploaded_by_admin_id ?? currentAdmin?.id,
      image_url: upload.url,
      alt: payload.alt,
      caption: payload.caption,
      is_published: payload.is_published
    });
  };

  const handleRequestItemDelete = (item) => {
    setEditingItem(null); // close edit dialog if open
    setConfirmation({
      type: 'delete-gallery',
      itemId: item.id,
      title: 'Remove photo',
      description: 'This photo will be removed from the gallery and any section placements. This cannot be undone.'
    });
  };

  const handleRequestCategoryDelete = (category) => {
    setEditingCategory(null);
    setConfirmation({
      type: 'delete-category',
      categoryId: category.id,
      title: 'Delete category',
      description: `Deleting "${category.name}" will also remove all photos in this category. This cannot be undone.`
    });
  };

  const handleConfirm = async () => {
    if (!confirmation) return;
    setConfirmBusy(true);
    try {
      if (confirmation.type === 'delete-gallery') {
        await deleteGalleryItem(confirmation.itemId);
      } else if (confirmation.type === 'delete-category') {
        await deleteCategory(confirmation.categoryId);
      }
      setConfirmation(null);
    } finally {
      setConfirmBusy(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <SectionTitle
        eyebrow="Admin"
        title="Gallery management"
        description="Upload photos, organise categories, and control which images appear on each page section."
      />

      {/* ── Tab bar ─────────────────────────────────────────────────────── */}
      <div className="flex items-end gap-1 border-b border-gray-200">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={[
              'px-4 py-2.5 -mb-px text-[11px] font-semibold uppercase tracking-[0.3em] transition border-b-2',
              activeTab === tab.key
                ? 'border-gray-900 text-gray-900'
                : 'border-transparent text-gray-400 hover:text-gray-700'
            ].join(' ')}
          >
            {tab.label}
            {tab.key === 'photos' && galleryItems.length > 0 && (
              <span className="ml-1.5 rounded-full bg-gray-100 px-1.5 py-0.5 text-[9px] text-gray-500">
                {galleryPagination.total}
              </span>
            )}
            {tab.key === 'categories' && categories.length > 0 && (
              <span className="ml-1.5 rounded-full bg-gray-100 px-1.5 py-0.5 text-[9px] text-gray-500">
                {categories.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Photos tab ──────────────────────────────────────────────────── */}
      {activeTab === 'photos' && (
        <div className="space-y-4">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" onClick={() => setUploadOpen(true)}>
              + Upload new photo
            </Button>

            {categories.length > 0 && (
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-xs text-gray-700 focus:border-gray-900 focus:outline-none"
              >
                <option value="">All categories</option>
                {categories.map((c) => (
                  <option key={c.id} value={String(c.id)}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}

            {filterCategory && (
              <button
                type="button"
                onClick={() => setFilterCategory('')}
                className="text-[10px] uppercase tracking-[0.3em] text-gray-400 hover:text-gray-900 transition"
              >
                Clear filter
              </button>
            )}
          </div>

          {/* Grid */}
          {filteredItems.length > 0 ? (
            <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
              {filteredItems.map((item) => (
                <GalleryPhotoCard
                  key={item.id}
                  item={item}
                  onEdit={setEditingItem}
                  onDelete={handleRequestItemDelete}
                />
              ))}
            </div>
          ) : (
            <Card className="flex flex-col items-center justify-center py-16 text-center">
              <svg
                className="mb-4 h-10 w-10 text-gray-200"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              <p className="text-sm text-gray-500">
                {filterCategory ? 'No photos in this category.' : 'No photos yet.'}
              </p>
              {!filterCategory && (
                <Button
                  type="button"
                  variant="secondary"
                  className="mt-4"
                  onClick={() => setUploadOpen(true)}
                >
                  Upload your first photo
                </Button>
              )}
            </Card>
          )}

          {/* Load more */}
          {galleryPagination.page < galleryPagination.pages && (
            <div className="flex justify-center">
              <Button type="button" variant="ghost" onClick={loadMoreGalleryItems}>
                Load more photos
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ── Placements tab ──────────────────────────────────────────────── */}
      {activeTab === 'placements' && (
        <div className="space-y-6">
          <p className="text-sm text-gray-600">
            Assign photos to specific slots on the homepage. The{' '}
            <span className="font-medium text-gray-800">/gallery</span> page shows all published photos
            automatically — no placement needed.
          </p>
          {Object.values(PLACEMENT_SECTIONS).map((sectionConfig, sIdx) => (
            <Card key={sectionConfig.key} className="space-y-4">
              <div className={sIdx > 0 ? '' : ''}>
                <h3 className="text-sm font-semibold uppercase tracking-[0.3em] text-gray-700">
                  {sectionConfig.label}
                  <span className="ml-2 font-normal text-gray-400">
                    ({sectionConfig.slotCount} slots)
                  </span>
                </h3>
              </div>
              <PlacementSectionPanel
                sectionConfig={sectionConfig}
                currentPlacements={placements[sectionConfig.key] || []}
                galleryItems={galleryItems}
                resolveUrl={resolveApiUrl}
                onSave={savePlacements}
              />
            </Card>
          ))}
        </div>
      )}

      {/* ── Categories tab ──────────────────────────────────────────────── */}
      {activeTab === 'categories' && (
        <div className="space-y-4">
          <CreateCategoryForm onSubmit={createCategory} />

          {categories.length > 0 ? (
            <div className="divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-200 bg-white">
              {categories.map((category) => (
                <div
                  key={category.id}
                  className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition"
                >
                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-900">{category.name}</span>
                      {!category.is_active && (
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-500">
                          Hidden
                        </span>
                      )}
                    </div>
                    {category.description && (
                      <p className="mt-0.5 truncate text-xs text-gray-500">{category.description}</p>
                    )}
                  </div>

                  {/* Count badge */}
                  <span className="shrink-0 rounded-full bg-gray-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-600">
                    {category.gallery_item_count ?? 0} photos
                  </span>

                  {/* Actions */}
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingCategory(category)}
                      className="text-[10px] font-semibold uppercase tracking-[0.3em] text-gray-500 transition hover:text-gray-900"
                    >
                      Edit
                    </button>
                    <span className="text-gray-200" aria-hidden>|</span>
                    <button
                      type="button"
                      onClick={() => handleRequestCategoryDelete(category)}
                      className="text-[10px] font-semibold uppercase tracking-[0.3em] text-gray-400 transition hover:text-rose-600"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">
              No categories yet. Create one above to start organising your photos.
            </div>
          )}
        </div>
      )}

      {/* ── Dialogs ─────────────────────────────────────────────────────── */}

      {uploadOpen && (
        <UploadDialog
          categories={categories}
          admins={admins}
          currentAdmin={currentAdmin}
          onUpload={handleUpload}
          onClose={() => setUploadOpen(false)}
        />
      )}

      {editingItem && (
        <EditItemDialog
          item={editingItem}
          categories={categories}
          onSave={updateGalleryItem}
          onDelete={handleRequestItemDelete}
          onClose={() => setEditingItem(null)}
        />
      )}

      {editingCategory && (
        <EditCategoryDialog
          category={editingCategory}
          onSave={updateCategory}
          onClose={() => setEditingCategory(null)}
        />
      )}

      <ConfirmDialog
        open={Boolean(confirmation)}
        title={confirmation?.title ?? 'Confirm'}
        description={confirmation?.description ?? ''}
        confirmLabel={confirmBusy ? 'Deleting…' : 'Delete'}
        onConfirm={handleConfirm}
        onClose={() => {
          if (!confirmBusy) setConfirmation(null);
        }}
        busy={confirmBusy}
      />
    </div>
  );
}
