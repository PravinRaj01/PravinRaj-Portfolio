
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Image, Video, FileText, Check, X, Folder, ArrowLeft } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { DriveFile, getFilesFromFolder, getFolderContents } from '@/services/googleDriveService';
import { generateDriveImageUrl } from '@/utils/googleDrive';

interface GoogleDriveFilePickerProps {
  onSelect: (file: DriveFile) => void;
  onCancel: () => void;
  selectedFileId?: string;
  fileTypes?: ('image' | 'video' | 'document')[];
}

interface FolderNavigationItem {
  id: string;
  name: string;
}

const GoogleDriveFilePicker = ({ 
  onSelect, 
  onCancel, 
  selectedFileId,
  fileTypes = ['image', 'video'] 
}: GoogleDriveFilePickerProps) => {
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [filteredFiles, setFilteredFiles] = useState<DriveFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [navigationStack, setNavigationStack] = useState<FolderNavigationItem[]>([]);
  const [showAllFiles, setShowAllFiles] = useState(false);

  const fetchFilesFromFolder = async (folderId?: string) => {
    setLoading(true);
    try {
      const driveFiles = await getFilesFromFolder(folderId);
      
      // Separate folders and files
      const folders = driveFiles.filter(file => file.mimeType === 'application/vnd.google-apps.folder');
      const regularFiles = driveFiles.filter(file => file.mimeType !== 'application/vnd.google-apps.folder');
      
      if (showAllFiles) {
        // Show all files and folders
        setFiles([...folders, ...regularFiles]);
        setFilteredFiles([...folders, ...regularFiles]);
      } else {
        // Show only supported file types
        const supportedFiles = regularFiles.filter(file => {
          const mimeType = file.mimeType.toLowerCase();
          return fileTypes.some(type => {
            switch (type) {
              case 'image':
                return mimeType.startsWith('image/');
              case 'video':
                return mimeType.startsWith('video/');
              case 'document':
                return mimeType.includes('document') || mimeType.includes('pdf');
              default:
                return false;
            }
          });
        });
        setFiles([...folders, ...supportedFiles]);
        setFilteredFiles([...folders, ...supportedFiles]);
      }
    } catch (error) {
      console.error('Failed to fetch files:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFilesFromFolder(currentFolderId);
  }, [fileTypes, showAllFiles, currentFolderId]);

  useEffect(() => {
    const filtered = files.filter(file => 
      file.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredFiles(filtered);
  }, [searchTerm, files]);

  const getFileIcon = (mimeType: string) => {
    if (mimeType === 'application/vnd.google-apps.folder') return <Folder className="w-4 h-4" />;
    if (mimeType.startsWith('image/')) return <Image className="w-4 h-4" />;
    if (mimeType.startsWith('video/')) return <Video className="w-4 h-4" />;
    return <FileText className="w-4 h-4" />;
  };

  const getFileType = (mimeType: string) => {
    if (mimeType === 'application/vnd.google-apps.folder') return 'Folder';
    if (mimeType.startsWith('image/')) return 'Image';
    if (mimeType.startsWith('video/')) return 'Video';
    return 'Document';
  };

  const handleFileClick = (file: DriveFile) => {
    if (file.mimeType === 'application/vnd.google-apps.folder') {
      // Navigate into folder
      setNavigationStack(prev => [...prev, { id: file.id, name: file.name }]);
      setCurrentFolderId(file.id);
      setSearchTerm(''); // Clear search when navigating
      return;
    }
    
    // Check if file is selectable
    const mimeType = file.mimeType.toLowerCase();
    const isSelectable = fileTypes.some(type => {
      switch (type) {
        case 'image':
          return mimeType.startsWith('image/');
        case 'video':
          return mimeType.startsWith('video/');
        case 'document':
          return mimeType.includes('document') || mimeType.includes('pdf');
        default:
          return false;
      }
    });

    if (isSelectable) {
      onSelect(file);
    }
  };

  const navigateBack = () => {
    if (navigationStack.length === 0) return;
    
    const newStack = [...navigationStack];
    newStack.pop();
    setNavigationStack(newStack);
    
    if (newStack.length === 0) {
      setCurrentFolderId(null);
    } else {
      setCurrentFolderId(newStack[newStack.length - 1].id);
    }
    setSearchTerm(''); // Clear search when navigating
  };

  const navigateToRoot = () => {
    setNavigationStack([]);
    setCurrentFolderId(null);
    setSearchTerm('');
  };

  const isFileSelectable = (file: DriveFile) => {
    if (file.mimeType === 'application/vnd.google-apps.folder') return false;
    
    const mimeType = file.mimeType.toLowerCase();
    return fileTypes.some(type => {
      switch (type) {
        case 'image':
          return mimeType.startsWith('image/');
        case 'video':
          return mimeType.startsWith('video/');
        case 'document':
          return mimeType.includes('document') || mimeType.includes('pdf');
        default:
          return false;
      }
    });
  };

  if (loading) {
    return (
      <Card className="w-full max-w-4xl mx-auto">
        <CardContent className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading files from Google Drive...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Select File from Google Drive</CardTitle>
            <CardDescription>
              Choose an {fileTypes.join(' or ')} from your connected Google Drive folder
            </CardDescription>
          </div>
          <Button variant="outline" onClick={onCancel}>
            <X className="w-4 h-4 mr-2" />
            Cancel
          </Button>
        </div>
        
        {/* Navigation breadcrumb */}
        {navigationStack.length > 0 && (
          <div className="flex items-center space-x-2 text-sm text-muted-foreground">
            <Button
              variant="ghost"
              size="sm"
              onClick={navigateToRoot}
              className="p-1 h-auto"
            >
              Root
            </Button>
            {navigationStack.map((folder, index) => (
              <React.Fragment key={folder.id}>
                <span>/</span>
                <span className="font-medium">{folder.name}</span>
              </React.Fragment>
            ))}
          </div>
        )}
        
        <div className="flex items-center space-x-4">
          {navigationStack.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={navigateBack}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          )}
          <Input
            placeholder="Search files..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-sm"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAllFiles(!showAllFiles)}
          >
            {showAllFiles ? 'Show Supported Only' : 'Show All Files'}
          </Button>
          <Badge variant="secondary">
            {filteredFiles.length} files found
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent>
        {filteredFiles.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">
              {showAllFiles ? 'No files found in this folder.' : `No ${fileTypes.join(' or ')} files found in this folder.`}
            </p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => setShowAllFiles(true)}
            >
              Show All Files
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredFiles.map((file) => (
              <motion.div
                key={file.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className={`group cursor-pointer ${!isFileSelectable(file) && file.mimeType !== 'application/vnd.google-apps.folder' ? 'opacity-50' : ''}`}
                onClick={() => handleFileClick(file)}
              >
                <Card className={`h-full hover:shadow-lg transition-shadow ${
                  selectedFileId === file.id ? 'ring-2 ring-primary' : ''
                } ${!isFileSelectable(file) && file.mimeType !== 'application/vnd.google-apps.folder' ? 'cursor-not-allowed' : ''}`}>
                  <div className="relative">
                    {file.mimeType.startsWith('image/') ? (
                      <img
                        src={generateDriveImageUrl(file.id, 'small')}
                        alt={file.name}
                        className="w-full h-32 object-cover rounded-t-lg"
                      />
                    ) : (
                      <div className="w-full h-32 bg-muted rounded-t-lg flex items-center justify-center">
                        {getFileIcon(file.mimeType)}
                      </div>
                    )}
                    
                    {selectedFileId === file.id && (
                      <div className="absolute top-2 right-2 bg-primary text-primary-foreground rounded-full p-1">
                        <Check className="w-4 h-4" />
                      </div>
                    )}
                    
                    <Badge 
                      className={`absolute top-2 left-2 text-xs ${
                        file.mimeType === 'application/vnd.google-apps.folder' ? 'bg-blue-500' : 'bg-secondary'
                      }`}
                      variant={file.mimeType === 'application/vnd.google-apps.folder' ? 'default' : 'secondary'}
                    >
                      {getFileType(file.mimeType)}
                    </Badge>
                  </div>
                  
                  <CardContent className="p-3">
                    <p className="text-sm font-medium truncate" title={file.name}>
                      {file.name}
                    </p>
                    {!isFileSelectable(file) && file.mimeType !== 'application/vnd.google-apps.folder' && (
                      <p className="text-xs text-muted-foreground">Not selectable</p>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default GoogleDriveFilePicker;
