import React from "react";
import { View, StyleSheet } from 'react-native';
import { Text } from '../i18n/ui';

export default function FavoritesScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        Favoritos
      </Text>

      <Text style={styles.text}>
        Aquí aparecerán tus productos favoritos.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container:{
    flex:1,
    justifyContent:"center",
    alignItems:"center"
  },
  title:{
    fontSize:28,
    fontWeight:"bold"
  },
  text:{
    marginTop:10
  }
});