import { useEffect, useMemo, useState } from 'react';
import Button from '../../components/Button.jsx';
import Card from '../../components/Card.jsx';
import ConfirmDialog from '../../components/ConfirmDialog.jsx';
import SectionTitle from '../../components/SectionTitle.jsx';
import { resolveApiUrl } from '../../lib/api.js';
import { useAdminDashboard } from './AdminDashboardContext.jsx';
import {
  getClientSideUploadError,
  getUploadErrorMessage,
  validateImageBeforeUpload
} from '../../lib/uploadValidation.js';

// ─── Section config ────────────────────────────────────────────────────────
const PLACEMENT_SECTIONS = {
  our_story: {
    key: 'our_story',
    label: 'Our Story',
    description: 'Four photo panels displayed in the "Our Story" section of the homepage. Each slot has a custom label shown over the photo.',
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

function buildEmptySlots(count) {
  return Array.from({ length: count }, (_, i) => ({
    display_order: i + 1,
    gallery_item_id: '',
    slot_label: ''
  }));
}

// ─── Single slot card ──────────────────────────────────────────────────────
function PlacementSlotCard({ slot, index, hasLabel, galleryItems, resolveUrl, onChange }) {
  const selectedItem = slot.gallery_item_id
    ? galleryItems.find((item) => String(item.id) === String(slot.gallery_item_id))
    : null;
  const thumbUrl = selectedItem ? resolveUrl(selectedItem.image_url) : null;
  const slotBaseId = `slot-${slot.display_order}`;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 space-y-3">
      {/* Slot number + thumbnail */}
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

      {/* Photo selector */}
      <div>
        <label
          htmlFor={`${slotBaseId}-photo`}
          className="text-[10px] uppercase tracking-[0.3em] text-gray-500"
        >
          Photo
        </label>
        <select
          id={`${slotBaseId}-photo`}
          value={slot.gallery_item_id}
          onChange={(e) => onChange(index, 'gallery_item_id', e.target.value)}
          className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-0"
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

      {/* Label (Our Story only) */}
      {hasLabel && (
        <div>
          <label
            htmlFor={`${slotBaseId}-label`}
            className="text-[10px] uppercase tracking-[0.3em] text-gray-500"
          >
            Slot label
          </label>
          <input
            id={`${slotBaseId}-label`}
            type="text"
            placeholder='e.g. "The Room"'
            value={slot.slot_label}
            onChange={(e) => onChange(index, 'slot_label', e.target.value)}
            className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-0"
          />
        </div>
      )}

      {/* Clear button */}
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

// ─── One section panel ─────────────────────────────────────────────────────
function PlacementSectionPanel({ sectionConfig, currentPlacements, galleryItems, resolveUrl, onSave }) {
  const { key, label, description, slotCount, hasLabel } = sectionConfig;

  const [slots, setSlots] = useState(() => buildEmptySlots(slotCount));
  const [saving, setSaving] = useState(false);

  // Sync incoming placements into slot drafts whenever they change
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

  const gridClass = slotCount === 4
    ? 'grid gap-3 sm:grid-cols-2'
    : 'grid gap-3 sm:grid-cols-2 lg:grid-cols-3';

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <p className="text-sm text-gray-600">{description}</p>
      </div>
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

const INITIAL_CATEGORY = { name: '', description: '', is_active: true };
const INITIAL_GALLERY_DRAFT = {
  category_id: '',
  label: '',
  caption: '',
  is_published: true,
  uploaded_by_admin_id: '',
  file: null,
  previewUrl: ''
};

const NEW_CATEGORY_FIELD_IDS = {
  name: 'new-category-name',
  description: 'new-category-description',
  active: 'new-category-active'
};

const NEW_GALLERY_FIELD_IDS = {
  file: 'new-gallery-file',
  category: 'new-gallery-category',
  uploader: 'new-gallery-uploader',
  isPublished: 'new-gallery-published',
  alt: 'new-gallery-alt',
  caption: 'new-gallery-caption'
};

export default function AdminGallery() {
  const {
    state: { categories, placements, galleryItems, galleryPagination, admins, currentAdmin },
    actions: {
      setFeedback,
      savePlacements,
      createCategory,
      updateCategory,
      toggleCategoryVisibility,
      deleteCategory,
      uploadMedia,
      createGalleryItem,
      updateGalleryItem,
      deleteGalleryItem,
      loadMoreGalleryItems
    }
  } = useAdminDashboard();

  const [categoryDrafts, setCategoryDrafts] = useState({});
  const [newCategory, setNewCategory] = useState(INITIAL_CATEGORY);

  const [galleryDrafts, setGalleryDrafts] = useState({});
  const [newItemDraft, setNewItemDraft] = useState(INITIAL_GALLERY_DRAFT);
  const [confirmation, setConfirmation] = useState(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [uploadError, setUploadError] = useState(null);

  useEffect(() => {
    const drafts = {};
    categories.forEach((category) => {
      drafts[category.id] = {
        name: category.name,
        description: category.description || '',
        is_active: Boolean(category.is_active)
      };
    });
    setCategoryDrafts(drafts);
  }, [categories]);

  useEffect(() => {
    const drafts = {};
    galleryItems.forEach((item) => {
      drafts[item.id] = {
        category_id: item.category?.id ? String(item.category.id) : '',
        alt: item.alt || '',
        caption: item.caption || '',
        is_published: Boolean(item.is_published)
      };
    });
    setGalleryDrafts(drafts);
  }, [galleryItems]);

  useEffect(() => {
    setNewItemDraft((prev) => ({
      ...prev,
      category_id: prev.category_id || (categories[0]?.id ? String(categories[0].id) : ''),
      uploaded_by_admin_id: prev.uploaded_by_admin_id || (currentAdmin?.id ? String(currentAdmin.id) : '')
    }));
  }, [categories, currentAdmin]);

  useEffect(() => {
    return () => {
      if (newItemDraft.previewUrl) {
        URL.revokeObjectURL(newItemDraft.previewUrl);
      }
    };
  }, [newItemDraft.previewUrl]);

  const adminOptions = useMemo(
    () => admins.map((admin) => ({ value: String(admin.id), label: admin.name })),
    [admins]
  );

  const categoryOptions = useMemo(
    () => categories.map((category) => ({ value: String(category.id), label: category.name })),
    [categories]
  );

  const handleNewCategoryChange = (field, value) => {
    setNewCategory((prev) => ({
      ...prev,
      [field]: field === 'is_active' ? Boolean(value) : value
    }));
  };

  const handleCategoryDraftChange = (categoryId, field, value) => {
    setCategoryDrafts((prev) => ({
      ...prev,
      [categoryId]: {
        ...prev[categoryId],
        [field]: field === 'is_active' ? Boolean(value) : value
      }
    }));
  };

  const handleGalleryDraftChange = (itemId, field, value) => {
    setGalleryDrafts((prev) => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        [field]: field === 'is_published' ? Boolean(value) : value
      }
    }));
  };

  const handleNewItemDraftChange = (field, value) => {
    setNewItemDraft((prev) => ({
      ...prev,
      [field]: field === 'is_published' ? Boolean(value) : value
    }));
  };

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }
    const validation = validateImageBeforeUpload(file);
    if (!validation.isValid) {
      setUploadError(getClientSideUploadError(validation.reason));
      return;
    }
    setUploadError(null);
    setNewItemDraft((prev) => {
      if (prev.previewUrl) {
        URL.revokeObjectURL(prev.previewUrl);
      }
      return {
        ...prev,
        file,
        previewUrl: URL.createObjectURL(file)
      };
    });
  };

  const resetNewItemDraft = () => {
    setUploadError(null);
    setNewItemDraft((prev) => {
      if (prev.previewUrl) {
        URL.revokeObjectURL(prev.previewUrl);
      }
      return {
        ...INITIAL_GALLERY_DRAFT,
        category_id: categories[0]?.id ? String(categories[0].id) : '',
        uploaded_by_admin_id: currentAdmin?.id ? String(currentAdmin.id) : ''
      };
    });
  };

  const handleCategoryCreate = async (event) => {
    event.preventDefault();
    if (!newCategory.name.trim()) {
      setFeedback({ tone: 'offline', message: 'Category name is required.' });
      return;
    }
    await createCategory({
      name: newCategory.name.trim(),
      description: newCategory.description.trim() || null,
      is_active: newCategory.is_active
    });
    setNewCategory(INITIAL_CATEGORY);
  };

  const handleCategorySave = async (categoryId) => {
    const draft = categoryDrafts[categoryId];
    if (!draft || !draft.name.trim()) {
      setFeedback({ tone: 'offline', message: 'Category name cannot be empty.' });
      return;
    }
    await updateCategory(categoryId, {
      name: draft.name.trim(),
      description: draft.description.trim() || null,
      is_active: draft.is_active
    });
  };

  const handleCategoryToggle = async (categoryId, isActive) => {
    await toggleCategoryVisibility(categoryId, isActive);
  };

  const requestCategoryDelete = (categoryId) => {
    setConfirmation({
      type: 'delete-category',
      categoryId,
      title: 'Delete category',
      description: 'Deleting a category also removes associated gallery items. Proceed?'
    });
  };

  const requestNewItemPreview = (event) => {
    event.preventDefault();
    if (!newItemDraft.file) {
      setFeedback({ tone: 'offline', message: 'Select an image before previewing.' });
      return;
    }
    const validation = validateImageBeforeUpload(newItemDraft.file);
    if (!validation.isValid) {
      const message = getClientSideUploadError(validation.reason);
      setUploadError(message);
      setFeedback({ tone: 'offline', message });
      return;
    }
    setUploadError(null);
    if (!newItemDraft.label.trim()) {
      setFeedback({ tone: 'offline', message: 'Provide alt text for accessibility.' });
      return;
    }
    if (!newItemDraft.category_id) {
      setFeedback({ tone: 'offline', message: 'Choose a category.' });
      return;
    }
    setConfirmation({
      type: 'publish',
      title: 'Publish gallery item',
      description: 'Review the new gallery item before publishing it publicly.',
      payload: {
        file: newItemDraft.file,
        label: newItemDraft.label.trim(),
        caption: newItemDraft.caption.trim(),
        category_id: Number(newItemDraft.category_id),
        uploaded_by_admin_id: newItemDraft.uploaded_by_admin_id
          ? Number(newItemDraft.uploaded_by_admin_id)
          : currentAdmin?.id,
        is_published: newItemDraft.is_published
      },
      previewUrl: newItemDraft.previewUrl
    });
  };

  const requestGalleryUpdate = (itemId) => {
    const draft = galleryDrafts[itemId];
    if (!draft || !draft.alt.trim()) {
      setFeedback({ tone: 'offline', message: 'Alt text cannot be empty.' });
      return;
    }
    setConfirmation({
      type: 'update-gallery',
      itemId,
      title: 'Update gallery item',
      description: 'Apply the edited details to this gallery entry?',
      payload: {
        category_id: draft.category_id ? Number(draft.category_id) : undefined,
        alt: draft.alt.trim(),
        caption: draft.caption.trim() || null,
        is_published: draft.is_published
      }
    });
  };

  const requestGalleryDelete = (itemId) => {
    setConfirmation({
      type: 'delete-gallery',
      itemId,
      title: 'Remove gallery item',
      description: 'This image will no longer appear in the public gallery. Continue?'
    });
  };

  const handleConfirm = async () => {
    if (!confirmation) {
      return;
    }
    setConfirmBusy(true);
    try {
      if (confirmation.type === 'publish') {
        const upload = await uploadMedia(confirmation.payload.file);
        await createGalleryItem({
          category_id: confirmation.payload.category_id,
          uploaded_by_admin_id: confirmation.payload.uploaded_by_admin_id ?? currentAdmin?.id,
          image_url: upload.url,
          alt: confirmation.payload.label,
          caption: confirmation.payload.caption || null,
          is_published: confirmation.payload.is_published
        });
        resetNewItemDraft();
      } else if (confirmation.type === 'update-gallery') {
        await updateGalleryItem(confirmation.itemId, confirmation.payload);
      } else if (confirmation.type === 'delete-gallery') {
        await deleteGalleryItem(confirmation.itemId);
      } else if (confirmation.type === 'delete-category') {
        await deleteCategory(confirmation.categoryId);
      }
      setConfirmation(null);
    } catch (err) {
      const uploadMessage = getUploadErrorMessage(err);
      const fallbackMessage =
        confirmation.type === 'publish'
          ? 'Unable to publish gallery item.'
          : confirmation.type === 'update-gallery'
          ? 'Unable to update gallery item.'
          : confirmation.type === 'delete-gallery'
          ? 'Unable to delete gallery item.'
          : 'Unable to delete category.';
      const finalMessage = uploadMessage || fallbackMessage;
      setFeedback({ tone: 'offline', message: finalMessage });
      if (uploadMessage) {
        setUploadError(uploadMessage);
      }
    } finally {
      setConfirmBusy(false);
    }
  };

  return (
    <div className="space-y-8">
      <SectionTitle
        eyebrow="Admin"
        title="Gallery management"
        description="Curate categories, upload new pieces, and review items before sharing them publicly."
      />

      {/* ── Section placements ────────────────────────────────── */}
      <Card className="space-y-6">
        <div className="space-y-2">
          <h3 className="text-sm font-semibold uppercase tracking-[0.3em] text-gray-500">
            Section placements
          </h3>
          <p className="text-sm text-gray-600">
            Choose which photos appear in each section of the site and set their display order.
            The <span className="font-medium text-gray-800">/gallery</span> page automatically
            shows all published photos grouped by category — no placement needed.
          </p>
        </div>

        {/* Tab-style toggle between sections */}
        {Object.values(PLACEMENT_SECTIONS).map((sectionConfig, sIdx) => (
          <div key={sectionConfig.key} className={sIdx > 0 ? 'border-t border-gray-100 pt-6' : ''}>
            <h4 className="mb-4 text-xs font-semibold uppercase tracking-[0.3em] text-gray-700">
              {sectionConfig.label}
              <span className="ml-2 text-gray-400">({sectionConfig.slotCount} slots)</span>
            </h4>
            <PlacementSectionPanel
              sectionConfig={sectionConfig}
              currentPlacements={placements[sectionConfig.key] || []}
              galleryItems={galleryItems}
              resolveUrl={resolveApiUrl}
              onSave={savePlacements}
            />
          </div>
        ))}
      </Card>

      {/* ── Categories ────────────────────────────────────────── */}
      <Card className="space-y-6">
        <div className="space-y-2">
          <h3 className="text-sm font-semibold uppercase tracking-[0.3em] text-gray-500">Categories</h3>
          <p className="text-sm text-gray-600">Organise artwork into curated collections.</p>
        </div>
        <form onSubmit={handleCategoryCreate} className="grid gap-3 md:grid-cols-3">
          <div>
            <label
              htmlFor={NEW_CATEGORY_FIELD_IDS.name}
              className="text-xs uppercase tracking-[0.3em] text-gray-500"
            >
              Category name
            </label>
            <input
              id={NEW_CATEGORY_FIELD_IDS.name}
              type="text"
              placeholder="Category name"
              value={newCategory.name}
              onChange={(event) => handleNewCategoryChange('name', event.target.value)}
              className="mt-2 rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-0"
            />
          </div>
          <div>
            <label
              htmlFor={NEW_CATEGORY_FIELD_IDS.description}
              className="text-xs uppercase tracking-[0.3em] text-gray-500"
            >
              Description
            </label>
            <input
              id={NEW_CATEGORY_FIELD_IDS.description}
              type="text"
              placeholder="Description (optional)"
              value={newCategory.description}
              onChange={(event) => handleNewCategoryChange('description', event.target.value)}
              className="mt-2 rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-0"
            />
          </div>
          <label
            htmlFor={NEW_CATEGORY_FIELD_IDS.active}
            className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-gray-500"
          >
            <input
              id={NEW_CATEGORY_FIELD_IDS.active}
              type="checkbox"
              checked={newCategory.is_active}
              onChange={(event) => handleNewCategoryChange('is_active', event.target.checked)}
              className="h-4 w-4 rounded border border-gray-400 text-gray-900 focus:ring-gray-900"
            />
            Active
          </label>
          <div className="md:col-span-3">
            <Button type="submit">Create category</Button>
          </div>
        </form>
        <div className="space-y-3">
          {categories.map((category) => {
            const draft = categoryDrafts[category.id] || {
              name: category.name,
              description: category.description || '',
              is_active: Boolean(category.is_active)
            };
            const baseId = `category-${category.id}`;
            const nameId = `${baseId}-name`;
            const descriptionId = `${baseId}-description`;
            const activeId = `${baseId}-active`;
            return (
              <div
                key={category.id}
                className="grid gap-3 rounded-2xl border border-gray-200 p-4 md:grid-cols-4"
              >
                <div>
                  <label
                    htmlFor={nameId}
                    className="text-xs uppercase tracking-[0.3em] text-gray-500"
                  >
                    Name
                  </label>
                  <input
                    id={nameId}
                    type="text"
                    value={draft.name}
                    onChange={(event) => handleCategoryDraftChange(category.id, 'name', event.target.value)}
                    className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-0"
                  />
                </div>
                <div>
                  <label
                    htmlFor={descriptionId}
                    className="text-xs uppercase tracking-[0.3em] text-gray-500"
                  >
                    Description
                  </label>
                  <input
                    id={descriptionId}
                    type="text"
                    value={draft.description}
                    onChange={(event) => handleCategoryDraftChange(category.id, 'description', event.target.value)}
                    className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-0"
                  />
                </div>
                <div className="flex flex-col justify-between gap-3">
                  <span className="text-xs uppercase tracking-[0.3em] text-gray-500">Visibility</span>
                  <div className="inline-flex items-center gap-2 text-sm text-gray-700">
                    <input
                      id={activeId}
                      type="checkbox"
                      checked={draft.is_active}
                      onChange={(event) => handleCategoryDraftChange(category.id, 'is_active', event.target.checked)}
                      className="h-4 w-4 rounded border border-gray-400 text-gray-900 focus:ring-gray-900"
                    />
                    <label htmlFor={activeId}>Active</label>
                  </div>
                  <p className="text-xs text-gray-500">{category.gallery_item_count} items</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Button type="button" onClick={() => handleCategorySave(category.id)}>
                    Save
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => handleCategoryToggle(category.id, !draft.is_active)}
                  >
                    {draft.is_active ? 'Hide' : 'Activate'}
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => requestCategoryDelete(category.id)}>
                    Delete
                  </Button>
                </div>
              </div>
            );
          })}
          {!categories.length ? (
            <div className="rounded-2xl border border-dashed border-gray-300 p-6 text-sm text-gray-500">
              Categories will appear here once created.
            </div>
          ) : null}
        </div>
      </Card>

      <Card className="space-y-6">
        <div className="space-y-2">
          <h3 className="text-sm font-semibold uppercase tracking-[0.3em] text-gray-500">
            Upload new artwork
          </h3>
          <p className="text-sm text-gray-600">
            Drag a new piece into the spotlight. Preview the post to double-check metadata before you publish.
          </p>
        </div>
        <form onSubmit={requestNewItemPreview} className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label
                htmlFor={NEW_GALLERY_FIELD_IDS.file}
                className="text-xs uppercase tracking-[0.3em] text-gray-500"
              >
                Upload
              </label>
              <input
                id={NEW_GALLERY_FIELD_IDS.file}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="mt-2 block w-full text-sm text-gray-700 file:mr-4 file:rounded-full file:border-0 file:bg-gray-900 file:px-4 file:py-2 file:text-xs file:font-semibold file:uppercase file:tracking-[0.3em] file:text-white hover:file:bg-gray-800"
              />
              {uploadError ? (
                <p className="mt-2 text-xs uppercase tracking-[0.3em] text-rose-600">{uploadError}</p>
              ) : null}
              {newItemDraft.previewUrl ? (
                <img
                  src={newItemDraft.previewUrl}
                  alt="Preview"
                  className="mt-3 h-40 w-full rounded-xl object-cover"
                />
              ) : null}
            </div>
            <div className="space-y-3">
              <div>
                <label
                  htmlFor={NEW_GALLERY_FIELD_IDS.category}
                  className="text-xs uppercase tracking-[0.3em] text-gray-500"
                >
                  Category
                </label>
                <select
                  id={NEW_GALLERY_FIELD_IDS.category}
                  value={newItemDraft.category_id}
                  onChange={(event) => handleNewItemDraftChange('category_id', event.target.value)}
                  className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-0"
                >
                  <option value="">Select category</option>
                  {categoryOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  htmlFor={NEW_GALLERY_FIELD_IDS.uploader}
                  className="text-xs uppercase tracking-[0.3em] text-gray-500"
                >
                  Uploaded by
                </label>
                <select
                  id={NEW_GALLERY_FIELD_IDS.uploader}
                  value={newItemDraft.uploaded_by_admin_id}
                  onChange={(event) => handleNewItemDraftChange('uploaded_by_admin_id', event.target.value)}
                  className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-0"
                >
                  <option value="">Select admin</option>
                  {adminOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-gray-500">
                <input
                  id={NEW_GALLERY_FIELD_IDS.isPublished}
                  type="checkbox"
                  checked={newItemDraft.is_published}
                  onChange={(event) => handleNewItemDraftChange('is_published', event.target.checked)}
                  className="h-4 w-4 rounded border border-gray-400 text-gray-900 focus:ring-gray-900"
                />
                <label htmlFor={NEW_GALLERY_FIELD_IDS.isPublished}>Publish immediately</label>
              </div>
            </div>
          </div>
          <label
            htmlFor={NEW_GALLERY_FIELD_IDS.alt}
            className="text-xs uppercase tracking-[0.3em] text-gray-500"
          >
            Alt text
          </label>
          <input
            id={NEW_GALLERY_FIELD_IDS.alt}
            type="text"
            placeholder="Alt text (required for accessibility)"
            value={newItemDraft.label}
            onChange={(event) => handleNewItemDraftChange('label', event.target.value)}
            className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-0"
          />
          <label
            htmlFor={NEW_GALLERY_FIELD_IDS.caption}
            className="text-xs uppercase tracking-[0.3em] text-gray-500"
          >
            Caption
          </label>
          <textarea
            id={NEW_GALLERY_FIELD_IDS.caption}
            rows={3}
            placeholder="Caption (optional)"
            value={newItemDraft.caption}
            onChange={(event) => handleNewItemDraftChange('caption', event.target.value)}
            className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-0"
          />
          <Button type="submit" disabled={confirmBusy}>
            {confirmBusy ? 'Uploading…' : 'Preview upload'}
          </Button>
        </form>
      </Card>

      <Card className="space-y-6">
        <div className="space-y-2">
          <h3 className="text-sm font-semibold uppercase tracking-[0.3em] text-gray-500">
            Gallery items
          </h3>
          <p className="text-sm text-gray-600">Edit published pieces, toggle visibility, or remove items.</p>
        </div>
        <div className="space-y-4">
        {galleryItems.map((item) => {
          const draft = galleryDrafts[item.id] || {
            category_id: item.category?.id ? String(item.category.id) : '',
            alt: item.alt || '',
            caption: item.caption || '',
            is_published: Boolean(item.is_published)
          };
            const itemBaseId = `gallery-${item.id}`;
            const categoryId = `${itemBaseId}-category`;
            const publishedId = `${itemBaseId}-published`;
            const altId = `${itemBaseId}-alt`;
            const captionId = `${itemBaseId}-caption`;
            const imageUrl = resolveApiUrl(item.image_url);
            return (
              <div
                key={item.id}
                className="grid gap-4 rounded-2xl border border-gray-200 p-4 md:grid-cols-[200px_1fr]"
              >
                <div>
                  <img
                    src={imageUrl}
                    alt={item.alt}
                    className="h-40 w-full rounded-xl object-cover"
                  />
                  <p className="mt-2 text-xs text-gray-500">
                    Uploaded {item.created_at ? new Date(item.created_at).toLocaleDateString() : 'Unknown'}
                  </p>
                </div>
                <div className="space-y-3">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <label
                        htmlFor={categoryId}
                        className="text-xs uppercase tracking-[0.3em] text-gray-500"
                      >
                        Category
                      </label>
                      <select
                        id={categoryId}
                        value={draft.category_id}
                        onChange={(event) => handleGalleryDraftChange(item.id, 'category_id', event.target.value)}
                        className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-0"
                      >
                        <option value="">Uncategorised</option>
                        {categoryOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <span className="text-xs uppercase tracking-[0.3em] text-gray-500">
                        Published
                      </span>
                      <div className="mt-2 inline-flex items-center gap-2 text-sm text-gray-700">
                        <input
                          id={publishedId}
                          type="checkbox"
                          checked={draft.is_published}
                          onChange={(event) => handleGalleryDraftChange(item.id, 'is_published', event.target.checked)}
                          className="h-4 w-4 rounded border border-gray-400 text-gray-900 focus:ring-gray-900"
                        />
                        <label htmlFor={publishedId}>Visible</label>
                      </div>
                    </div>
                  </div>
                  <div>
                    <label
                      htmlFor={altId}
                      className="text-xs uppercase tracking-[0.3em] text-gray-500"
                    >
                      Alt text
                    </label>
                    <input
                      id={altId}
                      type="text"
                      value={draft.alt}
                      onChange={(event) => handleGalleryDraftChange(item.id, 'alt', event.target.value)}
                      className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-0"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor={captionId}
                      className="text-xs uppercase tracking-[0.3em] text-gray-500"
                    >
                      Caption
                    </label>
                    <textarea
                      id={captionId}
                      rows={2}
                      value={draft.caption}
                      onChange={(event) => handleGalleryDraftChange(item.id, 'caption', event.target.value)}
                      className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-0"
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <Button type="button" onClick={() => requestGalleryUpdate(item.id)}>
                      Save changes
                    </Button>
                    <Button type="button" variant="ghost" onClick={() => requestGalleryDelete(item.id)}>
                      Delete
                    </Button>
                    <a
                      href={imageUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs uppercase tracking-[0.3em] text-gray-500 underline hover:text-gray-900"
                    >
                      Open image
                    </a>
                  </div>
                </div>
              </div>
            );
          })}
          {!galleryItems.length ? (
            <div className="rounded-2xl border border-dashed border-gray-300 p-6 text-sm text-gray-500">
              Gallery items will appear here as soon as they are published.
            </div>
          ) : null}
          {galleryItems.length > 0 && galleryPagination.page < galleryPagination.pages ? (
            <div className="flex justify-center">
              <Button type="button" variant="ghost" onClick={() => loadMoreGalleryItems()}>
                Load more items
              </Button>
            </div>
          ) : null}
        </div>
      </Card>

      <ConfirmDialog
        open={Boolean(confirmation)}
        title={confirmation?.title ?? 'Confirm'}
        description={confirmation?.description ?? ''}
        confirmLabel={
          confirmBusy
            ? 'Uploading…'
            : confirmation?.type === 'delete-gallery' || confirmation?.type === 'delete-category'
            ? 'Delete'
            : confirmation?.type === 'publish'
            ? 'Publish'
            : 'Save'
        }
        onConfirm={handleConfirm}
        onClose={() => {
          if (!confirmBusy) {
            setConfirmation(null);
          }
        }}
        busy={confirmBusy}
      >
        {confirmation?.type === 'publish' && confirmation?.previewUrl ? (
          <img
            src={confirmation.previewUrl}
            alt="Gallery preview"
            className="max-h-64 w-full rounded-xl object-cover"
          />
        ) : null}
        {confirmation?.type === 'publish' ? (
          <p className="text-sm text-gray-600">
            Category ID {confirmation.payload.category_id} · {' '}
            {confirmation.payload.is_published ? 'Visible immediately.' : 'Saved as draft.'}
          </p>
        ) : null}
      </ConfirmDialog>
    </div>
  );
}
