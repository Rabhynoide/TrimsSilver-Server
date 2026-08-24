// Generic market fees that apply to any sell order, not specific to any one
// calculator — shared by Farming and Crafting. Premium values confirmed
// against the user's own screenshot ("Sales tax 4.00%, Setup fee 2.50%" with
// Premium checked).
export const DEFAULT_SALES_TAX = { premium: 0.04, standard: 0.08 };
export const DEFAULT_SETUP_FEE = { premium: 0.025, standard: 0.03 };
