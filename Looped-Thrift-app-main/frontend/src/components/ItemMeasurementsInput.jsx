import React from 'react';

export default function ItemMeasurementsInput({ category, measurements = {}, onChange }) {
  const isBottom = category && (category.includes('Bottom') || category.includes('Skirt') || category.includes('Jeans') || category.includes('Trousers'));
  const isShoes = category && category.includes('Footwear');

  const handleFieldChange = (field, val) => {
    onChange({
      ...measurements,
      [field]: val ? Number(val) : undefined
    });
  };

  return (
    <div
      className="p-4 rounded-2xl border space-y-3 mt-3"
      style={{
        backgroundColor: 'var(--cream)',
        borderColor: 'var(--pink-cotton)'
      }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span>📐</span>
          <p className="text-xs font-bold" style={{ color: 'var(--pink-mauve)', fontFamily: "'Fredoka', sans-serif" }}>
            Add Garment Measurements (Optional) ✦
          </p>
        </div>
        <span className="text-[10px] text-gray-500">helps buyers buy with confidence</span>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        {!isShoes && (
          <>
            <div>
              <label className="text-[10px] font-semibold text-gray-600 block mb-0.5">Chest / Bust (cm)</label>
              <input
                type="number"
                placeholder="e.g. 96"
                value={measurements.chest || ''}
                onChange={e => handleFieldChange('chest', e.target.value)}
                className="input text-xs py-2"
              />
            </div>

            <div>
              <label className="text-[10px] font-semibold text-gray-600 block mb-0.5">Waist (cm)</label>
              <input
                type="number"
                placeholder="e.g. 78"
                value={measurements.waist || ''}
                onChange={e => handleFieldChange('waist', e.target.value)}
                className="input text-xs py-2"
              />
            </div>

            <div>
              <label className="text-[10px] font-semibold text-gray-600 block mb-0.5">Hips (cm)</label>
              <input
                type="number"
                placeholder="e.g. 102"
                value={measurements.hips || ''}
                onChange={e => handleFieldChange('hips', e.target.value)}
                className="input text-xs py-2"
              />
            </div>

            <div>
              <label className="text-[10px] font-semibold text-gray-600 block mb-0.5">Total Length (cm)</label>
              <input
                type="number"
                placeholder="e.g. 68"
                value={measurements.length || ''}
                onChange={e => handleFieldChange('length', e.target.value)}
                className="input text-xs py-2"
              />
            </div>

            <div>
              <label className="text-[10px] font-semibold text-gray-600 block mb-0.5">Shoulder Width (cm)</label>
              <input
                type="number"
                placeholder="e.g. 44"
                value={measurements.shoulder || ''}
                onChange={e => handleFieldChange('shoulder', e.target.value)}
                className="input text-xs py-2"
              />
            </div>

            {isBottom && (
              <div>
                <label className="text-[10px] font-semibold text-gray-600 block mb-0.5">Inseam (cm)</label>
                <input
                  type="number"
                  placeholder="e.g. 80"
                  value={measurements.inseam || ''}
                  onChange={e => handleFieldChange('inseam', e.target.value)}
                  className="input text-xs py-2"
                />
              </div>
            )}
          </>
        )}

        {isShoes && (
          <div>
            <label className="text-[10px] font-semibold text-gray-600 block mb-0.5">Insole Foot Length (cm)</label>
            <input
              type="number"
              placeholder="e.g. 26.5"
              value={measurements.footLength || ''}
              onChange={e => handleFieldChange('footLength', e.target.value)}
              className="input text-xs py-2"
            />
          </div>
        )}
      </div>
    </div>
  );
}
