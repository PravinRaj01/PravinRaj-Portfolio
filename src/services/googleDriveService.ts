import { apiClient } from "@/services/apiClient";

const FOLDER_ID = '1W0BOH7HfQLCggD3MEU548uzjaq3kWoVN';

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  thumbnailLink?: string;
  webViewLink: string;
  parents?: string[];
  modifiedTime?: string;
}

export const testGoogleDriveConnection = async (): Promise<{ success: boolean; message: string }> => {
  try {
    const result = await apiClient.get<{ success: boolean; message: string }>('/drive/test', {
      params: { folderId: FOLDER_ID },
    });
    return { success: result.success, message: result.message || 'Connection test completed' };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to connect to Google Drive'
    };
  }
};

export const getFileCount = async (): Promise<number> => {
  try {
    const data = await apiClient.get<{ count: number }>('/drive/count', { params: { folderId: FOLDER_ID } });
    return data.count || 0;
  } catch (error) {
    console.error('Error fetching file count:', error);
    return 0;
  }
};

export const getFilesFromFolder = async (folderId?: string): Promise<DriveFile[]> => {
  try {
    const targetFolderId = folderId || FOLDER_ID;
    const data = await apiClient.get<{ files: DriveFile[] }>('/drive/list', {
      params: { folderId: targetFolderId },
    });
    return data.files || [];
  } catch (error) {
    console.error('Error fetching files:', error);
    return [];
  }
};

export const getFolderContents = async (folderId: string): Promise<DriveFile[]> => {
  return getFilesFromFolder(folderId);
};
