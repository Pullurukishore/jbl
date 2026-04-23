-- MySQL dump 10.13  Distrib 8.0.19, for Win64 (x86_64)
--
-- Host: localhost    Database: kardex
-- ------------------------------------------------------
-- Server version	11.6.2-MariaDB

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `files`
--

DROP TABLE IF EXISTS `files`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `files` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `size` int(11) DEFAULT NULL,
  `type` varchar(255) DEFAULT NULL,
  `path` varchar(255) NOT NULL,
  `created_by` varchar(255) DEFAULT NULL,
  `updated_by` varchar(255) DEFAULT NULL,
  `created_date_time` datetime NOT NULL,
  `updated_date_time` datetime NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_uca1400_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `files`
--

LOCK TABLES `files` WRITE;
/*!40000 ALTER TABLE `files` DISABLE KEYS */;
INSERT INTO `files` VALUES (1,'kardex - Copy - Copy - Copy.csv',140,'text/csv','uploads/files/source-csv/kardex - Copy - Copy - Copy.csv','SYSTEM','SYSTEM','2025-01-04 09:37:06','2025-01-04 09:37:06'),(2,'kardex_1735983426666_nnn7qoddn.txt',268,'text/plain','uploads/files/put/kardex_1735983426666_nnn7qoddn.txt',NULL,NULL,'2025-01-04 09:37:06','2025-01-04 09:37:06'),(3,'kardex_1735983455622_hf1z2s897.txt',118,'text/plain','uploads/files/pick/kardex_1735983455622_hf1z2s897.txt',NULL,NULL,'2025-01-04 09:37:35','2025-01-04 09:37:35');
/*!40000 ALTER TABLE `files` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `log`
--

DROP TABLE IF EXISTS `log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `log` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `entity_number` varchar(255) DEFAULT NULL,
  `activity` varchar(255) DEFAULT NULL,
  `status` varchar(255) DEFAULT NULL,
  `message` varchar(255) DEFAULT NULL,
  `log_date_time` datetime NOT NULL,
  `logged_by` varchar(255) DEFAULT NULL,
  `process_id` varchar(255) NOT NULL,
  `log_type` varchar(255) DEFAULT NULL,
  `put_id` int(11) DEFAULT NULL,
  `pick_id` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `put_id` (`put_id`),
  KEY `pick_id` (`pick_id`),
  CONSTRAINT `log_ibfk_1` FOREIGN KEY (`put_id`) REFERENCES `put` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `log_ibfk_2` FOREIGN KEY (`pick_id`) REFERENCES `pick` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=15 DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_uca1400_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `log`
--

LOCK TABLES `log` WRITE;
/*!40000 ALTER TABLE `log` DISABLE KEYS */;
INSERT INTO `log` VALUES (1,'m1o','FETCH_DETAILS','SUCCESS',NULL,'2025-01-04 09:36:42','John Doe','e638b46c-f5ca-4d00-a103-f98f9fb41ea6','PUT_PROCESS',NULL,NULL),(2,'m1o','CHECK_STATUS','FAILED','Serial number not found in external api.','2025-01-04 09:36:42','John Doe','e638b46c-f5ca-4d00-a103-f98f9fb41ea6','PUT_PROCESS',NULL,NULL),(3,'m102','FETCH_DETAILS','SUCCESS',NULL,'2025-01-04 09:37:06','John Doe','9a9032e6-6195-4200-a51d-e7062a4cbb2d','PUT_PROCESS',1,NULL),(4,'m102','CHECK_STATUS','SUCCESS',NULL,'2025-01-04 09:37:06','John Doe','9a9032e6-6195-4200-a51d-e7062a4cbb2d','PUT_PROCESS',1,NULL),(5,'m102','PASS_FAIL','SUCCESS',NULL,'2025-01-04 09:37:06','John Doe','9a9032e6-6195-4200-a51d-e7062a4cbb2d','PUT_PROCESS',1,NULL),(6,'m102','FIND_CSV','SUCCESS',NULL,'2025-01-04 09:37:06','John Doe','9a9032e6-6195-4200-a51d-e7062a4cbb2d','PUT_PROCESS',1,NULL),(7,'m102','FIND_MODEL','SUCCESS',NULL,'2025-01-04 09:37:06','John Doe','9a9032e6-6195-4200-a51d-e7062a4cbb2d','PUT_PROCESS',1,NULL),(8,'m102','MODEL_FOUND/NOTFOUND','SUCCESS',NULL,'2025-01-04 09:37:06','John Doe','9a9032e6-6195-4200-a51d-e7062a4cbb2d','PUT_PROCESS',1,NULL),(9,'m102','CHECKING_AVAILABILITY','SUCCESS',NULL,'2025-01-04 09:37:06','John Doe','9a9032e6-6195-4200-a51d-e7062a4cbb2d','PUT_PROCESS',1,NULL),(10,'m102','FILE_GENERATED','SUCCESS',NULL,'2025-01-04 09:37:06','John Doe','9a9032e6-6195-4200-a51d-e7062a4cbb2d','PUT_PROCESS',1,NULL),(11,'m103','FETCH_DETAILS','SUCCESS',NULL,'2025-01-04 09:37:35','John Doe','64aa1635-799e-4577-96bb-aec5d5fb26ea','PICK_PROCESS',NULL,1),(12,'m103','CHECK_QTY','SUCCESS',NULL,'2025-01-04 09:37:35','John Doe','64aa1635-799e-4577-96bb-aec5d5fb26ea','PICK_PROCESS',NULL,1),(13,'m103','CHECK_STATUS','SUCCESS',NULL,'2025-01-04 09:37:35','John Doe','64aa1635-799e-4577-96bb-aec5d5fb26ea','PICK_PROCESS',NULL,1),(14,'m103','FILE_GENERATED','SUCCESS',NULL,'2025-01-04 09:37:35','John Doe','64aa1635-799e-4577-96bb-aec5d5fb26ea','PICK_PROCESS',NULL,1);
/*!40000 ALTER TABLE `log` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `pick`
--

DROP TABLE IF EXISTS `pick`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `pick` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `model_number` varchar(255) DEFAULT NULL,
  `quantity` varchar(255) DEFAULT NULL,
  `status` varchar(255) DEFAULT NULL,
  `entered_at` datetime NOT NULL,
  `text_file_downloaded` tinyint(1) NOT NULL DEFAULT 0,
  `entered_by` varchar(255) DEFAULT NULL,
  `text_file_id` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `text_file_id` (`text_file_id`),
  CONSTRAINT `pick_ibfk_1` FOREIGN KEY (`text_file_id`) REFERENCES `files` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_uca1400_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `pick`
--

LOCK TABLES `pick` WRITE;
/*!40000 ALTER TABLE `pick` DISABLE KEYS */;
INSERT INTO `pick` VALUES (1,'m103','1','SUCCESS','2025-01-04 09:37:35',1,'John Doe',3);
/*!40000 ALTER TABLE `pick` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `put`
--

DROP TABLE IF EXISTS `put`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `put` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `serial_number` varchar(255) DEFAULT NULL,
  `birth_date` datetime DEFAULT NULL,
  `pv_status` varchar(255) DEFAULT NULL,
  `status` varchar(255) DEFAULT NULL,
  `model_number` varchar(255) DEFAULT NULL,
  `text_file_downloaded` tinyint(1) NOT NULL DEFAULT 0,
  `scanned_at` datetime NOT NULL,
  `scanned_by` varchar(255) DEFAULT NULL,
  `pick_status` varchar(255) DEFAULT NULL,
  `pick_id` int(11) DEFAULT NULL,
  `text_file_id` int(11) DEFAULT NULL,
  `po_file_id` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `pick_id` (`pick_id`),
  KEY `text_file_id` (`text_file_id`),
  KEY `po_file_id` (`po_file_id`),
  CONSTRAINT `put_ibfk_1` FOREIGN KEY (`pick_id`) REFERENCES `pick` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `put_ibfk_2` FOREIGN KEY (`text_file_id`) REFERENCES `files` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `put_ibfk_3` FOREIGN KEY (`po_file_id`) REFERENCES `files` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_uca1400_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `put`
--

LOCK TABLES `put` WRITE;
/*!40000 ALTER TABLE `put` DISABLE KEYS */;
INSERT INTO `put` VALUES (1,'m102','2024-02-15 00:00:00','passed','ok','m103',1,'2025-01-04 09:37:06','John Doe','PICKED',1,2,1);
/*!40000 ALTER TABLE `put` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `user`
--

DROP TABLE IF EXISTS `user`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `first_name` varchar(255) NOT NULL,
  `last_name` varchar(255) DEFAULT NULL,
  `email` varchar(255) NOT NULL,
  `password` varchar(255) DEFAULT NULL,
  `created_at` datetime DEFAULT NULL,
  `status` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_uca1400_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user`
--

LOCK TABLES `user` WRITE;
/*!40000 ALTER TABLE `user` DISABLE KEYS */;
/*!40000 ALTER TABLE `user` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping routines for database 'kardex'
--
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-01-04 17:23:30
