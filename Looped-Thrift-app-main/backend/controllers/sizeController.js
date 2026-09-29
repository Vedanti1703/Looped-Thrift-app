const SizeProfile = require('../models/SizeProfile');
const Product = require('../models/Product');

// Save or update user's measurement profile
exports.saveSizeProfile = async (req, res) => {
  try {
    const userId = req.userId;
    const { gender, measurements, preferredFit } = req.body;

    let profile = await SizeProfile.findOne({ userId });
    if (profile) {
      profile.gender = gender || profile.gender;
      profile.measurements = measurements || profile.measurements;
      profile.preferredFit = preferredFit || profile.preferredFit;
      await profile.save();
    } else {
      profile = new SizeProfile({
        userId,
        gender: gender || 'unisex',
        measurements: measurements || {},
        preferredFit: preferredFit || 'regular'
      });
      await profile.save();
    }

    res.json(profile);
  } catch (err) {
    console.error('saveSizeProfile error:', err);
    res.status(500).json({ message: err.message || 'Error saving size profile' });
  }
};

// Retrieve user's size profile
exports.getSizeProfile = async (req, res) => {
  try {
    const userId = req.userId;
    const profile = await SizeProfile.findOne({ userId });
    res.json(profile || null);
  } catch (err) {
    console.error('getSizeProfile error:', err);
    res.status(500).json({ message: err.message || 'Error fetching size profile' });
  }
};

// Predict fit between user measurements and product itemMeasurements
exports.predictFit = async (req, res) => {
  try {
    const { productId } = req.params;
    const userId = req.userId;

    const [profile, product] = await Promise.all([
      SizeProfile.findOne({ userId }),
      Product.findById(productId)
    ]);

    if (!profile) return res.json({ hasProfile: false });
    if (!product) return res.status(404).json({ message: 'Product not found' });

    const itemM = product.itemMeasurements || {};
    const hasAnyMeasurement = Object.values(itemM).some(v => v !== null && v !== undefined && v > 0);

    if (!hasAnyMeasurement) {
      return res.json({ hasProfile: true, hasMeasurements: false });
    }

    const userM = profile.measurements || {};
    const fit = profile.preferredFit || 'regular';

    // Ease allowances by fit preference
    const EASE = { slim: 2, regular: 5, relaxed: 8, oversized: 12 };
    const ease = EASE[fit] || 5;

    const checks = [];

    if (itemM.chest && userM.chest) {
      const diff = itemM.chest - userM.chest;
      if (diff < -2)       checks.push({ part: 'chest', result: 'too_small', diff });
      else if (diff > 20)  checks.push({ part: 'chest', result: 'too_large', diff });
      else                 checks.push({ part: 'chest', result: 'fits', diff });
    }

    if (itemM.waist && userM.waist) {
      const diff = itemM.waist - userM.waist;
      if (diff < 0)        checks.push({ part: 'waist', result: 'too_small', diff });
      else if (diff > 16)  checks.push({ part: 'waist', result: 'too_large', diff });
      else                 checks.push({ part: 'waist', result: 'fits', diff });
    }

    if (itemM.hips && userM.hips) {
      const diff = itemM.hips - userM.hips;
      if (diff < 0)        checks.push({ part: 'hips', result: 'too_small', diff });
      else if (diff > 16)  checks.push({ part: 'hips', result: 'too_large', diff });
      else                 checks.push({ part: 'hips', result: 'fits', diff });
    }

    if (itemM.inseam && userM.inseam) {
      const diff = itemM.inseam - userM.inseam;
      if (diff < -4)       checks.push({ part: 'inseam', result: 'too_short', diff });
      else if (diff > 6)   checks.push({ part: 'inseam', result: 'too_long', diff });
      else                 checks.push({ part: 'inseam', result: 'fits', diff });
    }

    const tooSmall = checks.filter(c => c.result === 'too_small' || c.result === 'too_short').length;
    const tooLarge = checks.filter(c => c.result === 'too_large' || c.result === 'too_long').length;
    const fits     = checks.filter(c => c.result === 'fits').length;

    let verdict, confidence, message;
    if (tooSmall > 0) {
      const issuePart = checks.find(c => c.result === 'too_small' || c.result === 'too_short')?.part;
      verdict = 'too_small';
      confidence = 'high';
      message = `This item will likely be tight on you — especially the ${issuePart}.`;
    } else if (tooLarge > 1) {
      verdict = 'too_large';
      confidence = 'medium';
      message = 'This item may be quite loose on you based on your preferred fit.';
    } else if (fits === checks.length && checks.length > 0) {
      verdict = 'fits';
      confidence = 'high';
      message = 'Great news — this should fit you well! ✓';
    } else {
      verdict = 'likely_fits';
      confidence = 'low';
      message = 'Limited measurements available — likely fits based on standard sizing.';
    }

    res.json({
      hasProfile: true,
      hasMeasurements: true,
      verdict,
      confidence,
      message,
      checks
    });
  } catch (err) {
    console.error('predictFit error:', err);
    res.status(500).json({ message: err.message || 'Error predicting fit' });
  }
};
