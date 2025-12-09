/**
 * Utility for converting images to base64 data URLs
 */
export async function convertImageToBase64(imageUrl: string): Promise<string | null> {
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) {
      return null;
    }
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('Error converting image to base64:', error);
    return null;
  }
}

/**
 * Convert logo in document to base64 if it's a local asset
 */
export async function convertDocumentLogo(document: any): Promise<any> {
  if (!document.logo?.url) {
    return document;
  }

  const logoUrl = document.logo.url;
  if (logoUrl.startsWith('/assets/') || logoUrl.startsWith('assets/')) {
    const base64Url = await convertImageToBase64(logoUrl);
    if (base64Url) {
      return { ...document, logo: { ...document.logo, url: base64Url } };
    }
  }

  return document;
}

