"""Content types shown on the Content page.
Each type has:
  label - the name in the dropdown
  hint  - an example prompt shown in the text box
  style - words added to EVERY image prompt so all scenes share one look
  guide - rules given to the AI brain for this kind of content
To add a type: copy one block, give it a new key, save, and restart the backend.
"""

CONTENT_TYPES = {
    "auto": {
        "label": "Auto detect",
        "hint": "A cheetah hunting a deer in the African savanna. Make a 20 second video.",
        "style": "",
        "guide": "",
    },
    "food": {
        "label": "Food & beverage",
        "hint": "Promote our new masala dosa and filter coffee breakfast combo. 15 second video.",
        "style": "professional food photography, appetizing, natural window light, shallow depth of field, rich warm colours, clean background",
        "guide": """- Audience: food lovers and local customers. Tone: warm, friendly, mouth-watering.
- Scenes: hero shot of the dish, ingredients or preparation, close-up of texture or steam, serving or table setting, a happy dining moment (no recognisable faces).
- Mention taste, freshness and the occasion (breakfast, family dinner, festival). Add price, offer or address ONLY if the user gave them.
- Hashtags: dish name, cuisine, #foodie, #foodphotography, plus a local tag if a place is given.
- Never claim health benefits, hygiene awards or ratings the user did not state.""",
    },
    "realistic": {
        "label": "Realistic photo",
        "hint": "A busy fish market at sunrise in Visakhapatnam. 20 second video.",
        "style": "photorealistic, natural lighting, 35mm photograph, ultra detailed, true-to-life colours",
        "guide": """- Everything must look like a real photograph: believable places, animals, objects, light and proportions.
- No fantasy, cartoon or surreal elements unless the user asks for them.
- Scenes: establishing wide shot, main subject close-up, action or detail, atmosphere, closing shot.
- Never show recognisable real people or celebrities.""",
    },
    "nature": {
        "label": "Nature & wildlife",
        "hint": "A cheetah hunting a deer in the African savanna. 20 second video.",
        "style": "wildlife documentary photography, golden hour light, natural habitat, sharp focus on the subject, cinematic wide angle",
        "guide": """- Tell a story arc: habitat, the main animal, rising tension, the climax of the action, a calm ending.
- Describe the main animal identically in every scene (species, colours, markings) so it looks consistent.
- Keep it tasteful: no blood, no gore, no injury. Show speed, focus and landscape instead.
- Use only well-known facts. Hashtags: species, habitat, #wildlife, #naturephotography.""",
    },
    "travel": {
        "label": "Travel & places",
        "hint": "Promote a weekend trip to Araku Valley. Show the hills, coffee and sunrise.",
        "style": "travel photography, vivid natural colours, golden hour, wide angle, inviting atmosphere",
        "guide": """- Scenes: iconic view, local culture or street life, food or a local detail, a hidden gem, a sunset or closing view.
- Mention what makes the place special and who would enjoy it. Add best time, route or cost ONLY if the user gave them.
- Never invent prices, opening hours or distances.
- Hashtags: place name, region, #travel, #wanderlust.""",
    },
    "product": {
        "label": "Product & e-commerce",
        "hint": "Launch post for our steel water bottle. Highlight 24 hour cold and a leak-proof lid.",
        "style": "clean studio product photography, soft lighting, neutral background, sharp detail, premium look",
        "guide": """- Lead with the benefit to the buyer, then the feature that delivers it.
- Scenes: hero shot, close-up of a key detail, the product in use (hands only, no faces), a lifestyle setting, packaging or the full set.
- Never invent specifications, prices, discounts, ratings or certifications. Use only what the user gave.
- End with a clear call to action such as where to buy, only if the user gave that.""",
    },
    "fashion": {
        "label": "Fashion & beauty",
        "hint": "Festive collection of cotton sarees in rich pastel colours.",
        "style": "editorial fashion photography, soft studio light, stylish composition, rich textures",
        "guide": """- Focus on style, fabric, colour and the occasion. Do not name brands or show logos.
- Scenes: flat lay, close-up of fabric texture, a styled look without a recognisable face, accessories, the overall mood.
- Never promise skin, hair or body results, and never make medical claims.
- Hashtags: the garment or product, the season, #fashion, #style.""",
    },
    "fitness": {
        "label": "Fitness & health",
        "hint": "5 simple morning stretches for people who sit at a desk all day.",
        "style": "bright energetic lifestyle photography, clean gym or outdoor setting, natural light",
        "guide": """- Tone: motivating, practical, encouraging. Give simple tips, one step per scene.
- No medical claims, no guaranteed results, no weight-loss promises.
- For health topics add a short line such as: speak to a doctor or trainer if you have a medical condition.
- Hashtags: exercise name, #fitness, #healthylifestyle.""",
    },
    "education": {
        "label": "Education & training",
        "hint": "Announce our 3 month Python course for beginners. Starts next month.",
        "style": "clean bright modern illustration, friendly colours, simple clear shapes",
        "guide": """- Say who it is for, what they will learn and how to join. Use only the details the user gave.
- Scenes: the learner's problem, the course or lesson, the key skills, the outcome, a call to action.
- Never invent fees, dates, placement numbers, ratings or guarantees.
- Hashtags: the subject, #learning, #education, #upskill.""",
    },
    "tech": {
        "label": "Technology & software",
        "hint": "Explain how our new mobile app helps small shops track daily sales.",
        "style": "modern clean tech aesthetic, soft gradient lighting, minimal desk or abstract digital scene, blue and purple tones",
        "guide": """- Explain in plain words: the problem, how the product solves it, the benefit.
- Scenes: the problem, the app or device in use, a key feature, the result, a call to action.
- Never invent performance numbers, security claims, customers or awards. Do not show real company logos.
- Hashtags: the technology, #tech, #innovation.""",
    },
    "real_estate": {
        "label": "Real estate",
        "hint": "New 3 BHK apartments with a park view and a gym. Visit this weekend.",
        "style": "bright architectural photography, natural light, wide angle, tidy modern interior or exterior",
        "guide": """- Describe only the features the user gave. Never invent prices, areas, approvals or possession dates.
- Scenes: exterior, living area, kitchen, bedroom or balcony, the neighbourhood or amenities.
- Tone: warm and confident, with a clear call to action such as booking a visit, if given.
- Hashtags: city or area if given, #realestate, #newhome.""",
    },
    "events": {
        "label": "Events & festivals",
        "hint": "Invite everyone to our Sankranti celebration with kite flying and sweets.",
        "style": "vibrant festive photography, warm lights, lively atmosphere, rich colours, no readable text",
        "guide": """- Mention date, time and venue ONLY if the user gave them.
- Scenes: the venue or decorations, the main activities, the food or music, a crowd shown as silhouettes (no faces), a joyful finale.
- Treat cultural and religious festivals with respect and warmth.
- Hashtags: the event name, the festival, #celebration.""",
    },
    "jobs": {
        "label": "Jobs & hiring",
        "hint": "We are hiring a junior web developer in Hyderabad. Freshers welcome.",
        "style": "modern professional office scene, bright clean look, blue and purple tones",
        "guide": """- Cover the role, who can apply and how to apply, using only what the user gave. Never invent salary, benefits or requirements.
- Scenes: the workplace, the tools of the role, teamwork shown as silhouettes (no faces), growth, a call to apply.
- Do not show real company logos.
- Hashtags: the role, #hiring, #jobs, #careers.""",
    },
    "illustration": {
        "label": "Illustration & cartoon",
        "hint": "A short cartoon story about a little rabbit who learns to save money.",
        "style": "clean flat vector illustration, bold shapes, vibrant colours, simple background, consistent character design",
        "guide": """- Playful, friendly and family-safe. Use ONE main character and describe it identically in every scene.
- Scenes tell a simple story with a beginning, a small problem and a happy ending.
- Keep captions short and easy to read.""",
    },
}