import Event from '../models/Event.js';
import User from '../models/User.js';
import Company from '../models/Company.js';
import Customer from '../models/Customer.js';

export const getDashboardReport = async (req, res) => {
  try {
    const totalCustomers = await Customer.countDocuments();
    const totalCompanies = await Company.countDocuments();
    const totalLeads = totalCustomers + totalCompanies;
    const totalMeetings = await Event.countDocuments({ type: 'Meeting' });

    // Recent activity across these collections (mocked by sorting by createdAt)
    const recentCustomers = await Customer.find().sort({ createdAt: -1 }).limit(5).populate('createdBy', 'name');
    const recentCompanies = await Company.find().sort({ createdAt: -1 }).limit(5).populate('createdBy', 'name');
    const recentMeetings = await Event.find({ type: 'Meeting' }).sort({ createdAt: -1 }).limit(5).populate('createdBy', 'name');

    const recentActivities = [
      ...recentCustomers.map(c => ({ id: c._id, action: `New customer lead created: ${c.name}`, date: c.createdAt, user: c.createdBy?.name || 'System' })),
      ...recentCompanies.map(c => ({ id: c._id, action: `New company lead created: ${c.companyName}`, date: c.createdAt, user: c.createdBy?.name || 'System' })),
      ...recentMeetings.map(m => ({ id: m._id, action: `Meeting scheduled: ${m.title}`, date: m.createdAt, user: m.createdBy?.name || 'System' }))
    ].sort((a, b) => b.date - a.date).slice(0, 10);

    res.json({
      success: true,
      data: {
        metrics: {
          totalLeads,
          totalCustomers,
          totalCompanies,
          totalMeetings
        },
        recentActivities
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getSalesReport = async (req, res) => {
  try {
    const customers = await Customer.find().sort({ createdAt: -1 }).populate('createdBy', 'name');
    const companies = await Company.find().sort({ createdAt: -1 }).populate('createdBy', 'name');
    
    const unifiedLeads = [
      ...customers.map(c => ({
        id: c._id,
        name: c.name,
        company: 'N/A', // Customers don't have companyName usually
        status: c.leadStatus || 'New',
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        owner: c.createdBy?.name || 'System'
      })),
      ...companies.map(c => ({
        id: c._id,
        name: c.customerName || c.companyName,
        company: c.companyName,
        status: c.leadStatus || 'New',
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        owner: c.createdBy?.name || 'System'
      }))
    ];

    unifiedLeads.sort((a, b) => b.createdAt - a.createdAt);

    res.json({ success: true, data: unifiedLeads });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getMarketingReport = async (req, res) => {
  try {
    const customers = await Customer.find().sort({ createdAt: -1 });
    const companies = await Company.find().sort({ createdAt: -1 });

    const unifiedLeads = [
      ...customers.map(c => ({
        id: c._id,
        leadName: c.name,
        source: 'Organic/Unknown', 
        status: c.leadStatus || 'New',
        isConverted: c.leadStatus === 'Converted',
        dateAcquired: c.createdAt
      })),
      ...companies.map(c => ({
        id: c._id,
        leadName: c.companyName,
        source: 'Organic/Unknown', 
        status: c.leadStatus || 'New',
        isConverted: c.leadStatus === 'Converted',
        dateAcquired: c.createdAt
      }))
    ];

    unifiedLeads.sort((a, b) => b.dateAcquired - a.dateAcquired);

    res.json({ success: true, data: unifiedLeads });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getUserReport = async (req, res) => {
  try {
    const users = await User.find();
    
    const reportData = await Promise.all(users.map(async u => {
      const customersCreated = await Customer.countDocuments({ createdBy: u._id });
      const companiesCreated = await Company.countDocuments({ createdBy: u._id });
      const leadsCreated = customersCreated + companiesCreated;

      const meetingsCompleted = await Event.countDocuments({ createdBy: u._id, type: 'Meeting', status: 'Completed' });
      
      return {
        id: u._id,
        name: u.name,
        email: u.email,
        role: u.role,
        leadsCreated,
        meetingsCompleted,
        joinedAt: u.createdAt
      };
    }));

    res.json({ success: true, data: reportData });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getMeetingReport = async (req, res) => {
  try {
    const meetings = await Event.find({ type: 'Meeting' }).sort({ createdAt: -1 }).populate('createdBy', 'name');
    
    const reportData = meetings.map(m => ({
      id: m._id,
      title: m.title,
      date: m.date,
      status: m.status,
      durationMinutes: m.report?.durationMinutes || 0,
      hasSummary: !!m.report?.summary,
      organizer: m.createdBy?.name || 'System'
    }));

    res.json({ success: true, data: reportData });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
