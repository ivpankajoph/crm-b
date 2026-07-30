import mongoose from 'mongoose';

// Read-only CRM view over the WhatsApp module's existing `templates` collection.
// A separate model name avoids coupling CRM startup order to the bundled module.
const whatsAppTemplateSchema = new mongoose.Schema(
  {
    id: String,
    userId: String,
    name: String,
    status: String,
    metaStatus: String,
    category: String,
    language: String,
    subject: String,
    templateType: String,
    headerType: String,
    headerText: String,
    headerImageUrl: String,
    previewUrl: String,
    content: String,
    footer: String,
    buttons: [mongoose.Schema.Types.Mixed],
  },
  {
    collection: 'templates',
    strict: false,
    timestamps: false,
  },
);

const WhatsAppTemplate = mongoose.models.CRMWhatsAppTemplate
  || mongoose.model('CRMWhatsAppTemplate', whatsAppTemplateSchema);

export default WhatsAppTemplate;
