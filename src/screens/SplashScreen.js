import React, { useEffect } from "react";
import { View, StyleSheet } from "react-native";
import * as Animatable from "react-native-animatable";

export default function SplashScreen({ navigation }) {

  useEffect(() => {
    setTimeout(() => {
      navigation.replace("Login");
    }, 3000);
  }, []);

  return (
    <View style={styles.container}>

      <Animatable.Image
        animation="fadeIn"
        duration={2000}
        source={require("../../assets/images/logo.png")}
        style={styles.logo}
      />

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },

  logo: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
});