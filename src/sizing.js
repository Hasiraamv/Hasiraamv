// Standard UK/US men's shoe size conversion, the pairing used on most sneaker and streetwear
// box labels. It is the common approximate mapping (US is roughly UK + 1) -- a handful of
// brands run a half size off this, which is why the admin size field can still be typed
// freely instead of picked from this list when a piece needs an odd one.
export const SHOE_SIZES = [
  ['4', '5'],
  ['4.5', '5.5'],
  ['5', '6'],
  ['5.5', '6.5'],
  ['6', '7'],
  ['6.5', '7.5'],
  ['7', '8'],
  ['7.5', '8.5'],
  ['8', '9'],
  ['8.5', '9.5'],
  ['9', '10'],
  ['9.5', '10.5'],
  ['10', '11'],
  ['10.5', '11.5'],
  ['11', '12'],
  ['11.5', '12.5'],
  ['12', '13'],
  ['13', '14'],
];

export function shoeSizeLabel(uk, us) {
  return `UK ${uk} (US ${us})`;
}

export const SHOE_SIZE_LABELS = SHOE_SIZES.map(([uk, us]) => shoeSizeLabel(uk, us));

// EU shoe sizing, the other size system a listing can be typed in (size_type = 'eu') --
// same box-grid, multi-select picker as UK sizing, just a different label set.
export const EU_SHOE_SIZES = [
  '35', '35.5', '36', '36.5', '37', '37.5', '38', '38.5', '39', '39.5',
  '40', '40.5', '41', '41.5', '42', '42.5', '43', '44', '45', '46', '47', '48',
];
export const EU_SHOE_SIZE_LABELS = EU_SHOE_SIZES.map((eu) => `EU ${eu}`);

// Apparel (size_type = 'apparel') -- clothing letter sizes, same multi-select picker again.
export const APPAREL_SIZE_LABELS = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
