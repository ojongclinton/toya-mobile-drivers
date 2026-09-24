import { StyleSheet } from "react-native";
import { Colors } from "@/constants/Colors";

export default StyleSheet.create({
  container: {
    flex: 1,
    paddingTop:20
  },
  header: {
    height: 90,
    marginHorizontal: 25,
    borderRadius: 15,
    alignItems: "center",
    backgroundColor: Colors.light.tint,
  },
  headerContent: {
    flex: 1,
    alignItems: "center",
    marginTop: 50,
  },
  headerImage: {
    width: 80,
    height: 80,
    borderRadius: 100,
    borderColor: Colors.light.tint,
    borderWidth: 5,
    justifyContent: "center",
  },
  headerText: {
    fontSize: 20,
  },
  body: {
    marginTop: 150,
  },
  menuContainer: {
    flexDirection: "row",
    gap: 10,
    marginHorizontal: 25,
    marginVertical: 25,
    alignItems: "center",
  },
  menuText: {
    fontSize: 20,
  },
  separator: {
    height: 1,
    opacity: 0.1,
    backgroundColor: "black",
  },
  normal_text: {
    fontSize: 16,
  },
  heading_1: {
    fontSize: 25,
    fontWeight: "bold",
  },
  heading_2: {
    fontSize: 20,
    fontWeight: "bold",
  },
  heading_3: {
    fontSize: 17,
    fontWeight: "bold",
  },
});
