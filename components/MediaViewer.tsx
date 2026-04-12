import React, { useRef, useEffect } from 'react';
import { StyleSheet, View, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import Colors from '@/constants/colors';

interface MediaViewerProps {
  url: string;
  type: 'image' | 'video';
  height?: number;
}

const MediaViewer: React.FC<MediaViewerProps> = ({ url, type, height = 220 }) => {
  const [isLoading, setIsLoading] = React.useState(true);
  
  // Initialize video player if type is video
  const player = useVideoPlayer(url, (player) => {
    player.loop = true;
    player.play();
  });

  if (type === 'video') {
    return (
      <View style={[styles.container, { height }]}>
        <VideoView
          player={player}
          style={styles.media}
          contentFit="cover"
          allowsFullscreen
          allowsPictureInPicture
          onIsLoadingChange={(loading) => {
            if (!loading) setIsLoading(false);
          }}
        />
        {isLoading && (
          <View style={styles.loader}>
            <ActivityIndicator color={Colors.white} />
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={[styles.container, { height }]}>
      <Image
        source={url}
        style={styles.media}
        contentFit="cover"
        onLoad={() => setIsLoading(false)}
        transition={300}
      />
      {isLoading && (
        <View style={styles.loader}>
          <ActivityIndicator color={Colors.black} />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: Colors.surface,
    overflow: 'hidden',
  },
  media: {
    flex: 1,
  },
  loader: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
});

export default MediaViewer;
