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
