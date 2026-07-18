import Setting from '../models/Setting.js';

// @desc    Get global settings
// @route   GET /api/settings
// @access  Private
export const getSettings = async (req, res, next) => {
  try {
    let settings = await Setting.findOne();
    if (!settings) {
      settings = await Setting.create({});
    }
    res.json({ success: true, data: settings });
  } catch (error) {
    next(error);
  }
};

// @desc    Update global settings
// @route   PUT /api/settings
// @access  Private (Admin only usually, but we will protect the route in routes)
export const updateSettings = async (req, res, next) => {
  try {
    const { systemName, companyName, contactEmail, contactPhone } = req.body;
    
    let settings = await Setting.findOne();
    if (!settings) {
      settings = new Setting({});
    }

    if (systemName !== undefined) settings.systemName = systemName;
    if (companyName !== undefined) settings.companyName = companyName;
    if (contactEmail !== undefined) settings.contactEmail = contactEmail;
    if (contactPhone !== undefined) settings.contactPhone = contactPhone;

    await settings.save();
    
    res.json({ success: true, data: settings, message: 'Settings updated successfully' });
  } catch (error) {
    next(error);
  }
};
