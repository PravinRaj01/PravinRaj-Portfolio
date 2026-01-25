import { supabase } from "@/integrations/supabase/client";

const FOLDER_ID = '1W0BOH7HfQLCggD3MEU548uzjaq3kWoVN';

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  thumbnailLink?: string;
  webViewLink: string;
  parents?: string[];
}

export const testGoogleDriveConnection = async (): Promise<{ success: boolean; message: string }> => {
  try {
    const response = await fetch(
      `https://kadsdqnpxzgdxnnrdzra.supabase.co/functions/v1/google-drive-proxy?action=test&folderId=${FOLDER_ID}`,
      {
        headers: {
          'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImthZHNkcW5weHpnZHhubnJkenJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkwMzM3MDksImV4cCI6MjA2NDYwOTcwOX0.hBxdxwJOljZ4peYkYxN4Va_BcHqmqay7kQP7ijqio7s',
        }
      }
    );
    
    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }
    
    const result = await response.json();
    return {
      success: result.success,
      message: result.message || 'Connection test completed'
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to connect to Google Drive'
    };
  }
};

export const getFileCount = async (): Promise<number> => {
  try {
    const response = await fetch(
      `https://kadsdqnpxzgdxnnrdzra.supabase.co/functions/v1/google-drive-proxy?action=count&folderId=${FOLDER_ID}`,
      {
        headers: {
          'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImthZHNkcW5weHpnZHhubnJkenJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkwMzM3MDksImV4cCI6MjA2NDYwOTcwOX0.hBxdxwJOljZ4peYkYxN4Va_BcHqmqay7kQP7ijqio7s',
        }
      }
    );
    
    if (!response.ok) {
      throw new Error('Failed to fetch file count');
    }
    
    const data = await response.json();
    return data.count || 0;
  } catch (error) {
    console.error('Error fetching file count:', error);
    return 0;
  }
};

export const getFilesFromFolder = async (folderId?: string): Promise<DriveFile[]> => {
  try {
    const targetFolderId = folderId || FOLDER_ID;
    const response = await fetch(
      `https://kadsdqnpxzgdxnnrdzra.supabase.co/functions/v1/google-drive-proxy?action=list&folderId=${targetFolderId}`,
      {
        headers: {
          'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImthZHNkcW5weHpnZHhubnJkenJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkwMzM3MDksImV4cCI6MjA2NDYwOTcwOX0.hBxdxwJOljZ4peYkYxN4Va_BcHqmqay7kQP7ijqio7s',
        }
      }
    );
    
    if (!response.ok) {
      throw new Error('Failed to fetch files');
    }
    
    const data = await response.json();
    return data.files || [];
  } catch (error) {
    console.error('Error fetching files:', error);
    return [];
  }
};

export const getFolderContents = async (folderId: string): Promise<DriveFile[]> => {
  return getFilesFromFolder(folderId);
};
