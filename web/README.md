# MindMap Portugal - Premium Scrollytelling Experience

A cinematic, interactive scrollytelling web application exploring mental health in Portugal through data visualization, timelines, and narrative design.

## 🎨 Design Philosophy

This project embodies a **premium, cinematic aesthetic** inspired by modern design studios like Mily Group:

- **Glassmorphic UI**: Frosted glass effects with backdrop blur on navigation
- **3D Neural Mesh**: Interactive, pulsating neural network background that responds to mouse movement
- **Electric Neural Blue (#00A3FF)**: Primary accent color on deep black (#050508) background
- **Premium Typography**: Serif fonts (Lora/Merriweather) for headlines, Sans-serif (Inter) for data
- **Scroll-Triggered Animations**: Every narrative element animates in via Framer Motion as the user scrolls

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Installation

```bash
cd web
npm install
```

### Development Server

```bash
npm run dev
```

The application will be available at `http://localhost:3000`

### Production Build

```bash
npm run build
npm run start
```

## 📋 Project Structure

```
web/
├── app/
│   ├── layout.tsx          # Root layout with metadata
│   ├── page.tsx            # Main scrollytelling orchestrator
│   └── globals.css         # Global styles and Tailwind directives
├── components/
│   ├── NeuralMesh.tsx      # 3D interactive neural background
│   ├── GlassmorphicNav.tsx # Fixed navigation bar
│   ├── HeroSection.tsx     # Opening hero with title
│   ├── MapOfDeserts.tsx    # District visualization
│   ├── TimelineSection.tsx # Economic crisis timeline
│   ├── GoogleTrendsSection.tsx # Search trends heatmap
│   └── Footer.tsx          # Bottom section with links
├── package.json            # Dependencies
├── next.config.js          # Next.js configuration
├── tailwind.config.js      # Tailwind CSS customization
└── tsconfig.json           # TypeScript configuration
```

## 🎬 Sections

### 1. Hero Section
- Full-screen cinematic title over pulsating neural mesh
- Animated headline and subtitle
- Call-to-action button
- Floating scroll indicator

### 2. Map of Deserts
- Interactive district cards representing mental health resources
- Glassmorphic design with neural blue accents
- Hover effects and scale animations
- Scrolls into view with staggered animations

### 3. Timeline Section
- Economic events from 2008-2020
- Impact indicators with visual scaling
- Connected timeline dots with animated lines
- Smooth scroll-triggered reveals

### 4. Google Trends Section
- Search volume trends for mental health terms
- Animated heatmap bars
- Glowing effects and smooth bar animations
- WCAG AA contrast-compliant text

### 5. Footer
- Project information
- Navigation links
- Social media connections
- Copyright and accessibility notice

## 🎨 Technology Stack

- **Framework**: Next.js 14
- **Styling**: Tailwind CSS 3
- **Animation**: Framer Motion 10
- **Icons**: Lucide React
- **Data Parsing**: Papa Parse
- **Visualization**: D3.js
- **Language**: TypeScript

## ♿ Accessibility

This project meets **WCAG AA standards**:

- ✅ Minimum 4.5:1 contrast ratio on all text
- ✅ Semantic HTML structure with ARIA labels
- ✅ Keyboard navigation support
- ✅ Screen reader compatible
- ✅ Smooth scroll behavior enabled
- ✅ Accessible form controls

## 📊 Data Integration

The application is designed to consume data from:
- `/data/processed/dashboard_main.csv` - Main dashboard data
- `/data/processed/study_insights.json` - Study insights
- `/data/raw/google_trends_saude_mental_pt.csv` - Google Trends data

Data loading utilities can be added in the components directory as needed.

## 🎯 Key Features

### Interactive Neural Mesh
- Canvas-based 3D particle system
- Mouse-proximity reactive coloring
- Pulsating animation cycles
- Optimized rendering with requestAnimationFrame

### Scroll-Triggered Animations
- All sections animate in when scrolling into viewport
- Framer Motion's `useInView` hook for performance
- Staggered child animations for sequential reveals
- Smooth transitions and easing

### Glassmorphic Navigation
- Fixed positioning with sticky behavior
- Dynamic blur activation on scroll
- Mobile-responsive hamburger menu
- Smooth transitions between states

## 🔧 Configuration

### Tailwind Theme Extensions

The `tailwind.config.js` includes custom extensions:

```javascript
colors: {
  'neural-blue': '#00A3FF',
  'deep-black': '#050508',
}
```

### Font Configuration

Google Fonts are loaded in the layout:
- **Serif**: Lora, Merriweather (for headlines)
- **Sans**: Inter (for body text and data)

## 📱 Responsive Design

- Mobile-first approach
- Responsive typography scaling
- Touch-friendly interface
- Optimized for screens from 320px to 4K

## 🚀 Performance

- Server-side rendering with Next.js
- Optimized images and assets
- Lazy loading of components
- Efficient animation with Framer Motion

## 📝 CSS Classes

### Utilities
- `.glass` - Glassmorphism effect
- `.neural-accent` - Electric neural blue color
- `.scroll-fade-in` - Fade-in animation
- `@keyframes fadeInUp` - Scroll animation

## 🔒 Security

- No external API dependencies
- Data served locally
- CSP-friendly configuration

## 📄 License

This project is part of the MindMap Portugal initiative.

## 🤝 Contributing

For contributions, ensure:
1. WCAG AA compliance is maintained
2. Animations are smooth and performant
3. TypeScript types are properly defined
4. Components follow the established pattern

## 📞 Support

For issues or questions, refer to the component documentation or check the GitHub repository.

---

**Built with ❤️ for mental health awareness in Portugal**
