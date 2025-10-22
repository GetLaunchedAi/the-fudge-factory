#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Automated Sitemap Generator
 * Generates sitemap.xml automatically during build process
 */

// Configuration
const CONFIG = {
  baseUrl: 'https://thefudgefactoryinplainwell.com/',
  publicDir: path.join(__dirname, '../public'),
  outputFile: 'sitemap.xml',
  robotsFile: 'robots.txt',
  // Priority and changefreq rules
  rules: {
    '/': { priority: '1.00', changefreq: 'weekly' },
    '/about/': { priority: '0.80', changefreq: 'monthly' },
    '/contact/': { priority: '0.80', changefreq: 'monthly' },
    '/services/': { priority: '0.80', changefreq: 'monthly' },
    '/donations/': { priority: '0.80', changefreq: 'monthly' },
    '/property-donations/': { priority: '0.80', changefreq: 'monthly' },
    '/support/': { priority: '0.80', changefreq: 'monthly' },
    '/victim-process/': { priority: '0.80', changefreq: 'monthly' },
    '/shop/': { priority: '0.60', changefreq: 'weekly' },
    '/product/': { priority: '0.60', changefreq: 'weekly' },
    '/emergency-response/': { priority: '0.80', changefreq: 'monthly' },
    '/legal-protection/': { priority: '0.80', changefreq: 'monthly' },
    '/long-term-support/': { priority: '0.80', changefreq: 'monthly' },
    // Default for other pages
    default: { priority: '0.50', changefreq: 'monthly' }
  },
  // Exclude patterns
  exclude: [
    'robots.txt',
    '_redirects',
    'sitemap.xml',
    'assets/',
    'css/',
    'js/',
    'images/',
    'favicons/',
    'fonts/',
    'svgs/'
  ]
};

/**
 * Get file modification time in ISO format
 */
function getLastMod(filePath) {
  try {
    const stats = fs.statSync(filePath);
    return stats.mtime.toISOString();
  } catch (error) {
    console.warn(`Warning: Could not get modification time for ${filePath}`);
    return new Date().toISOString();
  }
}

/**
 * Check if path should be excluded
 */
function shouldExclude(relativePath) {
  return CONFIG.exclude.some(pattern => {
    if (pattern.endsWith('/')) {
      return relativePath.startsWith(pattern);
    }
    return relativePath === pattern || relativePath.endsWith(pattern);
  });
}

/**
 * Get priority and changefreq for a URL
 */
function getUrlConfig(url) {
  // Check for exact matches first
  if (CONFIG.rules[url]) {
    return CONFIG.rules[url];
  }
  
  // Check for product pages
  if (url.startsWith('/products/')) {
    return { priority: '0.60', changefreq: 'weekly' };
  }
  
  // Return default
  return CONFIG.rules.default;
}

/**
 * Convert file path to URL
 */
function pathToUrl(filePath, publicDir) {
  const relativePath = path.relative(publicDir, filePath);
  
  // Handle root index.html file
  if (relativePath === 'index.html') {
    return '/';
  }
  
  // Handle index.html files in subdirectories
  if (relativePath.endsWith('/index.html')) {
    return relativePath.replace('/index.html', '/');
  }
  
  // Handle other HTML files
  if (relativePath.endsWith('.html')) {
    return '/' + relativePath.replace('.html', '/');
  }
  
  return '/' + relativePath;
}

/**
 * Discover all HTML pages in public directory
 */
function discoverPages(publicDir) {
  const pages = [];
  
  function scanDirectory(dir) {
    try {
      const items = fs.readdirSync(dir);
      
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const relativePath = path.relative(publicDir, fullPath);
        
        // Skip excluded items
        if (shouldExclude(relativePath)) {
          continue;
        }
        
        const stats = fs.statSync(fullPath);
        
        if (stats.isDirectory()) {
          scanDirectory(fullPath);
        } else if (item.endsWith('.html')) {
          const url = pathToUrl(fullPath, publicDir);
          const lastmod = getLastMod(fullPath);
          const config = getUrlConfig(url);
          
          pages.push({
            url,
            lastmod,
            priority: config.priority,
            changefreq: config.changefreq
          });
        }
      }
    } catch (error) {
      console.warn(`Warning: Could not scan directory ${dir}:`, error.message);
    }
  }
  
  scanDirectory(publicDir);
  return pages;
}

/**
 * Load products from products.json
 */
function loadProducts(publicDir) {
  const productsFile = path.join(publicDir, 'products.json');
  
  try {
    const productsData = fs.readFileSync(productsFile, 'utf8');
    const data = JSON.parse(productsData);
    
    if (!data.products || !Array.isArray(data.products)) {
      console.warn('Warning: products.json does not contain a products array');
      return [];
    }
    
    return data.products.map(product => {
      const url = `/products/${product.slug}/`;
      const lastmod = new Date(data.generated_at || Date.now()).toISOString();
      
      return {
        url,
        lastmod,
        priority: '0.60',
        changefreq: 'weekly'
      };
    });
  } catch (error) {
    console.warn('Warning: Could not load products.json:', error.message);
    return [];
  }
}

/**
 * Generate XML sitemap content
 */
function generateSitemapXml(pages, products) {
  const allUrls = [...pages, ...products];
  
  // Sort URLs by priority (highest first), then by URL
  allUrls.sort((a, b) => {
    const priorityDiff = parseFloat(b.priority) - parseFloat(a.priority);
    if (priorityDiff !== 0) return priorityDiff;
    return a.url.localeCompare(b.url);
  });
  
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9
        http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">

`;
  
  for (const urlData of allUrls) {
    // Ensure no double slashes in URL
    const baseUrl = CONFIG.baseUrl.endsWith('/') ? CONFIG.baseUrl.slice(0, -1) : CONFIG.baseUrl;
    const urlPath = urlData.url.startsWith('/') ? urlData.url : '/' + urlData.url;
    const fullUrl = baseUrl + urlPath;
    
    xml += `  <url>
    <loc>${fullUrl}</loc>
    <lastmod>${urlData.lastmod}</lastmod>
    <changefreq>${urlData.changefreq}</changefreq>
    <priority>${urlData.priority}</priority>
  </url>

`;
  }
  
  xml += '</urlset>';
  return xml;
}

/**
 * Update robots.txt with correct sitemap URL
 */
function updateRobotsTxt() {
  const robotsPath = path.join(CONFIG.publicDir, CONFIG.robotsFile);
  const baseUrl = CONFIG.baseUrl.endsWith('/') ? CONFIG.baseUrl.slice(0, -1) : CONFIG.baseUrl;
  const sitemapUrl = `${baseUrl}/sitemap.xml`;
  
  try {
    let robotsContent;
    
    // Check if robots.txt exists
    if (fs.existsSync(robotsPath)) {
      robotsContent = fs.readFileSync(robotsPath, 'utf8');
    } else {
      // Create default robots.txt if it doesn't exist
      robotsContent = `User-agent: *
Disallow: /admin/
Allow: /

Sitemap: ${sitemapUrl}
`;
    }
    
    // Update or add sitemap URL
    const sitemapRegex = /^Sitemap:\s*.+$/m;
    if (sitemapRegex.test(robotsContent)) {
      // Replace existing sitemap line
      robotsContent = robotsContent.replace(sitemapRegex, `Sitemap: ${sitemapUrl}`);
    } else {
      // Add sitemap line if it doesn't exist
      robotsContent = robotsContent.trim() + `\n\nSitemap: ${sitemapUrl}\n`;
    }
    
    fs.writeFileSync(robotsPath, robotsContent, 'utf8');
    console.log(`🤖 Updated robots.txt with sitemap URL: ${sitemapUrl}`);
    
  } catch (error) {
    console.warn('Warning: Could not update robots.txt:', error.message);
  }
}

/**
 * Main function
 */
function generateSitemap() {
  console.log('🗺️  Generating sitemap...');
  
  // Check if public directory exists
  if (!fs.existsSync(CONFIG.publicDir)) {
    console.error('Error: Public directory does not exist. Run build first.');
    process.exit(1);
  }
  
  // Discover pages
  console.log('📄 Discovering pages...');
  const pages = discoverPages(CONFIG.publicDir);
  console.log(`Found ${pages.length} pages`);
  
  // Load products
  console.log('🛍️  Loading products...');
  const products = loadProducts(CONFIG.publicDir);
  console.log(`Found ${products.length} products`);
  
  // Generate sitemap
  console.log('⚙️  Generating XML...');
  const sitemapXml = generateSitemapXml(pages, products);
  
  // Write sitemap
  const outputPath = path.join(CONFIG.publicDir, CONFIG.outputFile);
  fs.writeFileSync(outputPath, sitemapXml, 'utf8');
  
  // Update robots.txt
  console.log('🤖 Updating robots.txt...');
  updateRobotsTxt();
  
  console.log(`✅ Sitemap generated successfully!`);
  console.log(`📊 Total URLs: ${pages.length + products.length}`);
  console.log(`📄 Pages: ${pages.length}`);
  console.log(`🛍️  Products: ${products.length}`);
  console.log(`📁 Output: ${outputPath}`);
}

// Run if called directly
if (require.main === module) {
  generateSitemap();
}

module.exports = { generateSitemap };
