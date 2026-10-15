import React, { useEffect, useRef, useState } from 'react';
import { Animated, Image, View, StyleSheet } from 'react-native';

// Skeleton únicamente mientras una imagen remota real se descarga.
export default function SmartImage({ source, style, resizeMode = 'cover' }) {
  const uri = typeof source === 'object' && source !== null && typeof source.uri === 'string';
  const [loading, setLoading] = useState(uri);
  const pulse = useRef(new Animated.Value(0.5)).current;
  useEffect(() => { setLoading(uri); }, [uri ? source.uri : source]);
  useEffect(() => {
    if (!loading) return;
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0.5, duration: 600, useNativeDriver: true }),
    ]));
    animation.start();
    return () => animation.stop();
  }, [loading, pulse]);
  return <View style={[style, styles.frame]}>
    {loading && <Animated.View style={[StyleSheet.absoluteFillObject, styles.skeleton, { opacity: pulse }]} />}
    <Image source={source} style={StyleSheet.absoluteFillObject} resizeMode={resizeMode}
      onLoadEnd={() => setLoading(false)} onError={() => setLoading(false)} />
  </View>;
}
const styles = StyleSheet.create({ frame: { overflow: 'hidden' }, skeleton: { backgroundColor: '#B8BDD0' } });
