
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Settings, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { testGoogleDriveConnection, getFilesFromFolder, DriveFile } from '@/services/googleDriveService';
import { generateDriveImageUrl } from '@/utils/googleDrive';

const GoogleDriveConfig = () => {
  const [connectionStatus, setConnectionStatus] = useState<{
    tested: boolean;
    success: boolean;
    message: string;
  }>({ tested: false, success: false, message: '' });
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [loading, setLoading] = useState(false);

  const handleTestConnection = async () => {
    setLoading(true);
    try {
      const result = await testGoogleDriveConnection();
      setConnectionStatus({
        tested: true,
        success: result.success,
        message: result.message
      });

      if (result.success) {
        const folderFiles = await getFilesFromFolder();
        setFiles(folderFiles.slice(0, 6)); // Show first 6 files as preview
      }
    } catch (error) {
      setConnectionStatus({
        tested: true,
        success: false,
        message: 'Failed to test connection'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Google Drive Integration
          </CardTitle>
          <CardDescription>
            Configure and test your Google Drive API connection for media storage
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">API Key</label>
              <p className="text-sm text-muted-foreground">AIza...G4M (configured)</p>
            </div>
            <div>
              <label className="text-sm font-medium">Folder ID</label>
              <p className="text-sm text-muted-foreground">1W0B...oVN (configured)</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Button 
              onClick={handleTestConnection} 
              disabled={loading}
              className="flex items-center gap-2"
            >
              {loading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Settings className="w-4 h-4" />
              )}
              Test Connection
            </Button>

            {connectionStatus.tested && (
              <div className="flex items-center gap-2">
                {connectionStatus.success ? (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-500" />
                )}
                <span className="text-sm">{connectionStatus.message}</span>
              </div>
            )}
          </div>

          {files.length > 0 && (
            <div>
              <h4 className="font-medium mb-3">Recent Files Preview</h4>
              <div className="grid grid-cols-3 gap-4">
                {files.map((file) => (
                  <div key={file.id} className="border rounded-lg p-3">
                    {file.mimeType.startsWith('image/') && (
                      <img
                        src={generateDriveImageUrl(file.id, 'small')}
                        alt={file.name}
                        className="w-full h-20 object-cover rounded mb-2"
                      />
                    )}
                    <p className="text-xs font-medium truncate">{file.name}</p>
                    <Badge variant="secondary" className="text-xs mt-1">
                      {file.mimeType.split('/')[1]}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default GoogleDriveConfig;
