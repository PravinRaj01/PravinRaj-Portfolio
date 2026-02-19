

# Add GA4 (gtag.js) to index.html

You have a GA4 Measurement ID (`G-0KJR8K7FG5`) from Google Analytics. The simplest fix is to add the `gtag.js` snippet directly into `index.html` alongside your existing GTM code. This way Google Analytics will work immediately without needing to configure tags inside GTM.

## What changes

**File: `index.html`**

Add the GA4 gtag.js snippet right after the existing GTM block (after line 10):

```html
<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-0KJR8K7FG5"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-0KJR8K7FG5');
</script>
```

## Also: CLS fixes from the approved plan

Since the previous plan was approved, this implementation will also include the CLS improvements:
- **SplashScreen**: Use `fixed inset-0 z-[9999]` positioning to prevent layout shift
- **Hero images**: Add explicit width/height attributes
- **Font preload**: Add `<link rel="preload">` for Poppins in `index.html`

## After deploying

1. Visit your site
2. Open [Google Analytics Real-Time](https://analytics.google.com) -- you should see yourself as an active user
3. You can also verify with [Tag Assistant](https://tagassistant.google.com/) by entering your site URL

