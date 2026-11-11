// The AQUENORA seller interview (app.aquenora.com/interview): market research with potential
// sellers. Answers are saved with each question's wording, so changing a question later doesn't
// mix up old answers. Bump VERSION when the questions change meaningfully.

export const VERSION = '1';

export type Question =
  | { id: string; kind: 'single'; q: string; help?: string; options: string[]; other?: boolean; optional?: boolean; when?: (a: Answers) => boolean }
  | { id: string; kind: 'multi'; q: string; help?: string; options: string[]; other?: boolean; max?: number; optional?: boolean; when?: (a: Answers) => boolean }
  | { id: string; kind: 'text' | 'long'; q: string; help?: string; placeholder?: string; optional?: boolean; when?: (a: Answers) => boolean }
  | { id: string; kind: 'money'; q: string; help?: string; optional?: boolean; when?: (a: Answers) => boolean }
  | { id: string; kind: 'rate'; q: string; help?: string; items: string[]; scale: [string, string, string]; optional?: boolean; when?: (a: Answers) => boolean };

export type Answer = string | string[] | Record<string, string>;
export type Answers = Record<string, Answer | undefined>;

export interface Section {
  id: string;
  title: string;
  intro: string;
  questions: Question[];
}

const has = (a: Answers, id: string, ...values: string[]) => {
  const v = a[id];
  return Array.isArray(v) ? v.some(x => values.includes(x)) : typeof v === 'string' && values.includes(v);
};

export const COUNTRIES = ['Nigeria', 'Ghana', 'South Africa', 'Kenya', "Côte d'Ivoire", 'Senegal', 'Cameroon', 'Rwanda', 'Uganda', 'Tanzania', 'Egypt', 'Morocco', 'United Kingdom', 'United States', 'Canada'];

/** Currency symbol for money questions, from the country answer. */
export const CURRENCY: Record<string, string> = {
  Nigeria: '₦', Ghana: 'GH₵', 'South Africa': 'R', Kenya: 'KSh', "Côte d'Ivoire": 'CFA', Senegal: 'CFA', Cameroon: 'FCFA',
  Rwanda: 'RWF', Uganda: 'USh', Tanzania: 'TSh', Egypt: 'E£', Morocco: 'MAD', 'United Kingdom': '£', 'United States': '$', Canada: 'CA$',
};

export const SECTIONS: Section[] = [
  {
    id: 'about',
    title: 'You and your business',
    intro: 'A few quick facts so we understand who you are.',
    questions: [
      { id: 'country', kind: 'single', q: 'Where is your business based?', options: COUNTRIES, other: true },
      { id: 'city', kind: 'text', q: 'Which city or town?', placeholder: 'e.g. Lagos, Kumasi, Durban', optional: true },
      {
        id: 'category', kind: 'multi', q: 'What do you sell?', help: 'Tick all that apply.',
        options: ['Fashion & clothing', 'Shoes & bags', 'Beauty, skincare & hair', 'Jewellery & accessories', 'Food, drinks & snacks', 'Art & crafts', 'Home & decor', 'Electronics & gadgets', 'Health & wellness', 'Books & education', 'Digital products (courses, ebooks, templates)', 'Services (bookings, classes, repairs)'],
        other: true,
      },
      { id: 'stage', kind: 'single', q: 'How long have you been selling?', options: ['Not started yet, planning to', 'Less than 1 year', '1 to 3 years', '3 to 5 years', 'More than 5 years'] },
      { id: 'team', kind: 'single', q: 'Who runs the business?', options: ['Just me', 'Me with family or friends helping', 'A small team (2 to 5 people)', 'A bigger team (6 or more)'] },
      { id: 'registered', kind: 'single', q: 'Is your business registered (e.g. CAC, Registrar-General)?', options: ['Yes', 'In progress', 'No', 'Not sure what this means'] },
      { id: 'side_or_main', kind: 'single', q: 'Is this business your main income?', options: ['Yes, it is my main income', 'No, it is a side business', 'It is growing into my main income'] },
      { id: 'location_type', kind: 'single', q: 'Where do customers find you in person?', options: ['I have a shop', 'A market stall', 'I work from home', "Online only, no physical place"] },
    ],
  },
  {
    id: 'selling',
    title: 'How you sell today',
    intro: 'Tell us how orders and payments work for you right now.',
    questions: [
      {
        id: 'sell_where', kind: 'multi', q: 'Where do you sell today?', help: 'Tick all that apply.',
        options: ['WhatsApp (chats, status, catalogue)', 'Instagram', 'Facebook or Marketplace', 'TikTok', 'X (Twitter)', 'Jumia, Konga or another marketplace', 'My own website', 'A shop or market', 'Word of mouth / referrals'],
        other: true,
      },
      { id: 'main_channel', kind: 'single', q: 'Which ONE brings you the most sales?', options: ['WhatsApp', 'Instagram', 'Facebook', 'TikTok', 'A marketplace (Jumia, Konga…)', 'My own website', 'My shop or market', 'Word of mouth'] },
      { id: 'website_tool', kind: 'multi', q: 'Have you used any of these to sell online?', options: ['Shopify', 'Selar', 'Bumpa', 'Paystack Storefront', 'Flutterwave Store', 'Wix or Squarespace', 'WooCommerce (WordPress)', 'Instagram or Facebook Shop', 'None of these'], other: true, optional: true },
      { id: 'orders_week', kind: 'single', q: 'About how many orders do you get in a normal week?', options: ['None yet', '1 to 5', '6 to 20', '21 to 50', '51 to 100', 'More than 100'] },
      { id: 'order_value', kind: 'money', q: 'What does a typical order cost your customer?', help: 'A rough figure is fine.', optional: true },
      { id: 'monthly_sales', kind: 'single', q: 'Roughly, what are your sales in a month (in US dollars)?', help: 'Only to group answers. Skip it if you prefer.', options: ['Under $100', '$100 to $500', '$500 to $2,000', '$2,000 to $10,000', 'Over $10,000', "I'd rather not say"], optional: true },
      {
        id: 'pay_methods', kind: 'multi', q: 'How do customers pay you?', help: 'Tick all that apply.',
        options: ['Bank transfer', 'Cash on delivery', 'Card', 'USSD', 'Mobile money', 'POS terminal', 'A payment link (Paystack, Flutterwave…)', 'PayPal or foreign transfer'],
        other: true,
      },
      { id: 'delivery', kind: 'multi', q: 'How do your orders get to customers?', options: ['I deliver myself', 'Dispatch riders', 'A logistics company (GIG, Kwik, Sendbox…)', 'Bus or park transport', 'Customers pick up', 'International courier (DHL, FedEx, UPS…)'], other: true },
      { id: 'sell_abroad', kind: 'single', q: 'Do you sell to customers outside your country?', options: ['Yes, often', 'Sometimes', 'No, but I want to', "No, and I'm not interested"] },
      {
        id: 'abroad_where', kind: 'multi', q: 'Where are (or would be) your customers abroad?',
        options: ['Other African countries', 'United Kingdom', 'Europe', 'United States', 'Canada', 'Middle East', 'Asia', 'Australia'],
        when: a => has(a, 'sell_abroad', 'Yes, often', 'Sometimes', 'No, but I want to'), optional: true,
      },
      {
        id: 'abroad_blocker', kind: 'multi', q: 'What makes selling abroad hard?',
        options: ['Taking payment from foreign cards', 'Showing prices in their currency', 'Shipping costs', 'Customs and paperwork', 'Customers don\'t trust a seller they can\'t see', 'Finding a reliable courier'],
        other: true, when: a => has(a, 'sell_abroad', 'Yes, often', 'Sometimes', 'No, but I want to'), optional: true,
      },
    ],
  },
  {
    id: 'challenges',
    title: 'What makes selling hard',
    intro: 'This is the most important part. Be honest. There are no wrong answers.',
    questions: [
      {
        id: 'challenges', kind: 'multi', max: 3, q: 'Pick your 3 biggest challenges.',
        options: [
          'Getting new customers', 'Customers not trusting online sellers', 'Confirming payments (fake alerts, checking transfers)', 'Customers who order and never pay',
          'Delivery costs and logistics', 'Failed deliveries and returns', 'Keeping track of orders in chats', 'Knowing what is in stock',
          'Knowing my real profit', 'Looking professional (photos, website)', 'Too much time answering the same questions', 'Fees charged by platforms or banks',
          'Getting paid by customers abroad', 'Getting a loan or funding',
        ],
        other: true,
      },
      { id: 'one_problem', kind: 'long', q: 'If we could fix ONE problem for your business, what should it be?', placeholder: 'Tell us in your own words.' },
      { id: 'story', kind: 'long', q: 'Tell us about a time selling online went wrong. What happened?', placeholder: 'e.g. a customer said they paid but the money never came…', optional: true },
      { id: 'scammed', kind: 'single', q: 'Have you ever lost money to a fake payment alert or a scam customer?', options: ['Yes, more than once', 'Yes, once', 'No, but it nearly happened', 'No'] },
      { id: 'admin_time', kind: 'single', q: 'How many hours a week do you spend on chats, confirming payments and arranging delivery?', options: ['Less than 2 hours', '2 to 5 hours', '5 to 10 hours', '10 to 20 hours', 'More than 20 hours'] },
      { id: 'records', kind: 'single', q: 'How do you keep track of sales and orders?', options: ['A notebook', 'Excel or Google Sheets', 'An app', 'WhatsApp chats and memory', "I don't really keep track"], other: true },
      { id: 'know_profit', kind: 'single', q: 'Do you know how much profit you make each month?', options: ['Yes, exactly', 'Roughly', 'Not really'] },
    ],
  },
  {
    id: 'wishlist',
    title: 'What would help you',
    intro: 'AQUENORA gives you an online store, payments by card and transfer straight to your bank, and tools to grow. Tell us what matters.',
    questions: [
      {
        id: 'features', kind: 'rate', q: 'How much would each of these help you?', scale: ['Must have', 'Nice to have', "Don't need"],
        items: [
          'My own online store link to share on WhatsApp and Instagram',
          'Customers pay by card, transfer or USSD in one checkout',
          'Payments confirmed automatically (no more fake alerts)',
          'Money goes straight into my own bank account',
          'New order alerts on WhatsApp',
          'Stock that updates by itself when I sell',
          'Booking delivery and tracking it',
          'Selling abroad with prices in the buyer\'s currency',
          'Seeing my profit, not just my sales',
          'Messaging past customers with offers',
          'My own website address (like myshop.com)',
          'Customers picking up from my shop',
          'Customer reviews on my store',
          'Receipts and invoices sent automatically',
          'A phone app to run my store',
          'Staff accounts for people who help me',
        ],
      },
      { id: 'missing', kind: 'long', q: 'Is there anything else you wish an online store could do for you?', optional: true },
    ],
  },
  {
    id: 'money',
    title: 'Paying for it',
    intro: 'This helps us set fair prices. Your answers don\'t commit you to anything.',
    questions: [
      { id: 'pays_now', kind: 'single', q: 'Do you pay for any tools for your business today (website, apps, ads)?', options: ['Yes, every month', 'Sometimes', 'No'] },
      { id: 'pays_now_amount', kind: 'money', q: 'About how much a month, in total?', optional: true, when: a => has(a, 'pays_now', 'Yes, every month', 'Sometimes') },
      {
        id: 'pricing_model', kind: 'single', q: 'Which way of paying for an online store would you prefer?',
        options: ['Free to start, a small fee only when I make a sale', 'A fixed monthly fee and a lower fee per sale', 'A fixed monthly fee, nothing per sale', 'Not sure'],
      },
      { id: 'price_fair', kind: 'money', q: 'For an online store with everything you ticked as "Must have", what monthly price would feel fair?', optional: true },
      { id: 'price_too_much', kind: 'money', q: 'At what monthly price would it be too expensive to consider?', optional: true },
      { id: 'fee_ok', kind: 'single', q: 'If there\'s no monthly fee, what fee per sale feels acceptable?', options: ['1%', '2%', '3%', '5%', 'Any fee is too much'] },
    ],
  },
  {
    id: 'trust',
    title: 'Trust and support',
    intro: 'Almost done.',
    questions: [
      {
        id: 'trust', kind: 'multi', max: 3, q: 'What would make you trust a new platform with your sales and payments?', help: 'Pick up to 3.',
        options: ['Money lands in my own bank account', 'It uses Paystack, a name I know', 'Other sellers I know use it', 'A free trial with no card needed', 'A real person to talk to on WhatsApp', 'Clear, simple fees', 'Good reviews online', 'A local team in my country'],
        other: true,
      },
      { id: 'support', kind: 'single', q: 'How do you prefer to get help?', options: ['WhatsApp chat', 'Phone call', 'Email', 'Video guides', 'Chat inside the app'] },
      { id: 'language', kind: 'multi', q: 'Which languages are you comfortable with?', options: ['English', 'Pidgin', 'French', 'Yoruba', 'Hausa', 'Igbo', 'Twi', 'Swahili', 'Zulu', 'Arabic'], other: true },
      { id: 'device', kind: 'single', q: 'What do you mostly run your business on?', options: ['Android phone', 'iPhone', 'Laptop or computer', 'Phone and computer equally'] },
      { id: 'data_worry', kind: 'single', q: 'Is internet data cost a worry when you use business apps?', options: ['Yes, a big worry', 'A little', 'No'] },
      { id: 'stopper', kind: 'long', q: 'What would stop you from using a platform like AQUENORA?', optional: true },
      {
        id: 'likely', kind: 'single', q: 'If AQUENORA did what you need, how likely are you to try it?',
        options: ['Very likely', 'Likely', 'Not sure', 'Unlikely'],
      },
    ],
  },
];

export const ALL_QUESTIONS = SECTIONS.flatMap(s => s.questions.map(q => ({ ...q, section: s.title })));
